use actix_session::Session;
use actix_web::{
    body::{EitherBody, MessageBody},
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, FromRequest, HttpResponse,
};
use std::future::{ready, Ready};
use std::pin::Pin;
use std::rc::Rc;

use crate::auth;

/// Middleware to require authentication for routes
pub struct RequireAuth;

impl<S, B> Transform<S, ServiceRequest> for RequireAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = RequireAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RequireAuthMiddleware {
            service: Rc::new(service),
        }))
    }
}

pub struct RequireAuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for RequireAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let path = req.path().to_string();

        // Exempt routes from authentication middleware
        // - /auth/* - authentication routes (login, register, etc.)
        // - /api/* - API routes (authentication handled by extractors:
        //            SentryAuth for ingest, AuthenticatedUser for management)
        // - /health - health check routes
        let is_exempt =
            path.starts_with("/auth") || path.starts_with("/api/") || path.starts_with("/health");

        if is_exempt {
            let service = Rc::clone(&self.service);
            return Box::pin(
                async move { service.call(req).await.map(|res| res.map_into_left_body()) },
            );
        }

        // Check session for authenticated user
        let http_req = req.request();
        let session = Session::extract(http_req).into_inner();

        let service = Rc::clone(&self.service);

        Box::pin(async move {
            match session {
                Ok(session) => {
                    if auth::get_user_id_from_session(&session).is_some() {
                        // User is authenticated
                        service.call(req).await.map(|res| res.map_into_left_body())
                    } else {
                        // Not authenticated
                        let (http_req, _) = req.into_parts();
                        let response = HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "Not authenticated"
                            }))
                            .map_into_boxed_body();
                        Ok(ServiceResponse::new(http_req, response).map_into_right_body())
                    }
                }
                Err(_) => {
                    // Session error
                    let (http_req, _) = req.into_parts();
                    let response = HttpResponse::Unauthorized()
                        .json(serde_json::json!({
                            "error": "Session error"
                        }))
                        .map_into_boxed_body();
                    Ok(ServiceResponse::new(http_req, response).map_into_right_body())
                }
            }
        })
    }
}
