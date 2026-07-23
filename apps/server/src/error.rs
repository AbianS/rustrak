use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;

/// JSON error response structure
#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ErrorDetail {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
    /// Machine-readable annotations naming the inputs that were rejected.
    ///
    /// Omitted from the JSON entirely when empty, so every consumer written
    /// before this existed keeps seeing exactly the body it saw before.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<FieldError>,
}

/// One rejected input, named as data rather than buried in the prose of
/// [`ErrorDetail::message`].
///
/// `field` is a **dot path into the request body** (`slug`,
/// `credentials.webhook_url`), not a JSON Pointer and not a UI label: a
/// consumer feeds it straight to a form library's `setError`.
///
/// The rejected *value* is deliberately never echoed back. One careless
/// application to a password input would put a credential in the log store.
///
/// The three fields are private on purpose. [`Self::new`] and [`Self::custom`]
/// are the only ways to build one, which is what makes "`message` is populated
/// only alongside [`FieldErrorCode::Custom`]" an invariant the compiler holds
/// rather than a convention a struct literal could quietly break.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FieldError {
    field: String,
    code: FieldErrorCode,
    /// Only for what [`FieldErrorCode`] cannot express, and then only
    /// alongside [`FieldErrorCode::Custom`]. Consumers pick their copy from
    /// `(field, code)` so it can be translated, and never parse this.
    ///
    /// `nullable = false`: `skip_serializing_if` means the key is *absent*,
    /// never `null`, so a generated client must not model a null it can never
    /// receive.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "openapi", schema(nullable = false))]
    message: Option<String>,
}

impl FieldError {
    /// A field annotation carrying no bespoke message, which is the shape
    /// every site should be using.
    pub fn new(field: impl Into<String>, code: FieldErrorCode) -> Self {
        Self {
            field: field.into(),
            code,
            message: None,
        }
    }

    /// A [`FieldErrorCode::Custom`] annotation with prose the code set cannot
    /// express. Reach for it only after failing to find an honest code.
    pub fn custom(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            code: FieldErrorCode::Custom,
            message: Some(message.into()),
        }
    }

    /// The dot path into the request body this annotation blames.
    pub fn field(&self) -> &str {
        &self.field
    }

    /// The closed-vocabulary reason.
    pub fn code(&self) -> FieldErrorCode {
        self.code
    }

    /// The bespoke prose, present only for [`FieldErrorCode::Custom`].
    pub fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }
}

/// The closed vocabulary a [`FieldError`] may use.
///
/// Deliberately small and resource-agnostic: a large or per-endpoint
/// vocabulary becomes a public API that cannot be versioned. Adding a variant
/// is a wire change and requires the matching addition to the TypeScript union
/// in `packages/client/src/errors.ts`, which
/// `packages/client/tests/unit/app-error-contract.test.ts` enforces by parsing
/// this enum out of this file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum FieldErrorCode {
    /// Absent or empty, and mandatory.
    Required,
    /// Malformed, or not acceptable for this particular request.
    ///
    /// The two readings are deliberately one code, and the **status** is what
    /// tells them apart. `(role, invalid)` on a **400** means the value is not
    /// a member of the enum at all ("`superuser` is not a role"); the same
    /// `(role, invalid)` on a **409** means the value is well-formed but not
    /// acceptable *right now* ("this is the last admin"). A consumer that
    /// wants different copy for the two must branch on `kind`/status as well
    /// as on `(field, code)`.
    Invalid,
    /// Taken. The thing only the server can know, and always a 409.
    AlreadyExists,
    /// Below the minimum length.
    TooShort,
    /// Above the maximum length.
    TooLong,
    /// Read [`FieldError::message`] instead.
    Custom,
}

/// An [`AppError`] together with the fields it blames.
///
/// Holds the error it decorates rather than restating its status and wire
/// `type`, so an annotated `Conflict` is a 409 named `Conflict` by
/// construction and cannot drift from a plain one.
///
/// Both fields are private and there is no public constructor:
/// [`AppError::with_fields`] is the only way to build one, which is what turns
/// "`inner` is never itself an [`AppError::WithFields`]" from a comment into
/// an invariant. It has to be enforced rather than documented, because
/// [`AppError::kind`], [`AppError::error_type`] and `status_code` all recurse
/// through `inner` while [`AppError::field_errors`] reads one level: a nested
/// value would emit the right status and message and silently drop the inner
/// annotations.
#[derive(Debug, thiserror::Error)]
#[error("{inner}")]
pub struct FieldedError {
    inner: Box<AppError>,
    fields: Vec<FieldError>,
}

impl FieldedError {
    /// The error being decorated. Never an [`AppError::WithFields`].
    pub fn inner(&self) -> &AppError {
        &self.inner
    }

    /// The inputs this error blames.
    pub fn fields(&self) -> &[FieldError] {
        &self.fields
    }
}

/// Application errors
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Payload too large: {0}")]
    PayloadTooLarge(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal server error: {0}")]
    Internal(String),

    /// Any of the eight above, annotated with the fields it blames.
    ///
    /// A decorator, not a ninth kind of error: it has no status, no wire
    /// `type` and no message of its own, and is only ever built through
    /// [`AppError::with_field`] / [`AppError::with_fields`]. That is what
    /// keeps the eight the whole vocabulary, and what let the ~105 call sites
    /// that have no field to name stay untouched.
    #[error(transparent)]
    WithFields(FieldedError),
}

impl AppError {
    /// Annotates this error with one rejected field, keeping its status, its
    /// wire `type` and its message exactly as they were.
    ///
    /// ```ignore
    /// AppError::Conflict(format!("Project with slug '{slug}' already exists"))
    ///     .with_field("slug", FieldErrorCode::AlreadyExists)
    /// ```
    #[must_use]
    pub fn with_field(self, field: impl Into<String>, code: FieldErrorCode) -> Self {
        self.with_fields(vec![FieldError::new(field, code)])
    }

    /// Annotates this error with several rejected fields.
    ///
    /// Appends when the error is already annotated, which is what keeps
    /// [`FieldedError::inner`] from ever being a [`AppError::WithFields`]
    /// however many times this is called.
    #[must_use]
    pub fn with_fields(self, fields: Vec<FieldError>) -> Self {
        match self {
            AppError::WithFields(mut fielded) => {
                fielded.fields.extend(fields);
                AppError::WithFields(fielded)
            }
            inner => AppError::WithFields(FieldedError {
                inner: Box::new(inner),
                fields,
            }),
        }
    }

    /// This error with any field annotation stripped.
    ///
    /// What a `match` on the variant wants: `err.kind()` is
    /// `AppError::Conflict(_)` whether or not the error names a field, while
    /// matching `err` itself would silently miss every annotated one.
    pub fn kind(&self) -> &AppError {
        match self {
            AppError::WithFields(fielded) => fielded.inner.kind(),
            other => other,
        }
    }

    /// The `error.type` literal this error serialises as. An annotated error
    /// delegates, so it can never report a type its inner error would not.
    fn error_type(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "NotFound",
            AppError::Validation(_) => "ValidationError",
            AppError::Conflict(_) => "Conflict",
            AppError::Unauthorized(_) => "Unauthorized",
            AppError::Forbidden(_) => "Forbidden",
            AppError::PayloadTooLarge(_) => "PayloadTooLarge",
            AppError::Database(_) => "DatabaseError",
            AppError::Internal(_) => "InternalError",
            AppError::WithFields(fielded) => fielded.inner.error_type(),
        }
    }

    /// The fields this error blames, empty when it blames none.
    fn field_errors(&self) -> &[FieldError] {
        match self {
            AppError::WithFields(fielded) => &fielded.fields,
            _ => &[],
        }
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::WithFields(fielded) => fielded.inner.status_code(),
        }
    }

    fn error_response(&self) -> HttpResponse {
        let response = ErrorResponse {
            error: ErrorDetail {
                error_type: self.error_type().to_string(),
                message: self.to_string(),
                fields: self.field_errors().to_vec(),
            },
        };

        HttpResponse::build(self.status_code()).json(response)
    }
}

/// Result type alias for handlers
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// The no-nesting invariant is what makes `field_errors()` (which reads
    /// one level) agree with `kind()`/`error_type()`/`status_code()` (which
    /// recurse). Annotating twice must append, never nest.
    #[test]
    fn annotating_twice_appends_rather_than_nesting() {
        let error = AppError::Conflict("taken".to_string())
            .with_field("name", FieldErrorCode::AlreadyExists)
            .with_field("slug", FieldErrorCode::AlreadyExists);

        let AppError::WithFields(ref fielded) = error else {
            panic!("expected an annotated error");
        };
        assert!(
            !matches!(fielded.inner(), AppError::WithFields(_)),
            "FieldedError::inner must never be another WithFields"
        );
        assert_eq!(fielded.fields().len(), 2);

        // The lossy read and the recursive reads agree, which is the whole
        // point of the invariant.
        assert_eq!(error.field_errors().len(), 2);
        assert_eq!(error.error_type(), "Conflict");
        assert_eq!(error.status_code(), StatusCode::CONFLICT);
        assert!(matches!(error.kind(), AppError::Conflict(_)));
    }

    /// `new` never attaches prose, `custom` always does, and there is no third
    /// way to build a `FieldError`.
    #[test]
    fn only_custom_carries_a_message() {
        let plain = FieldError::new("slug", FieldErrorCode::AlreadyExists);
        assert_eq!(plain.message(), None);
        assert_eq!(plain.code(), FieldErrorCode::AlreadyExists);
        assert_eq!(plain.field(), "slug");

        let custom = FieldError::custom("credentials.webhook_url", "Slack said no.");
        assert_eq!(custom.code(), FieldErrorCode::Custom);
        assert_eq!(custom.message(), Some("Slack said no."));
    }

    /// A code other than `custom` must serialise without a `message` key at
    /// all, not with a null.
    #[test]
    fn a_non_custom_code_serialises_no_message_key() {
        let json = serde_json::to_value(FieldError::new("name", FieldErrorCode::TooLong))
            .expect("FieldError must serialise");
        assert_eq!(
            json,
            serde_json::json!({ "field": "name", "code": "too_long" })
        );
    }
}
