import { RustrakClient } from '@rustrak/client';

/**
 * The API base URL.
 *
 * `window.location.origin` is not a fallback, it is the design. The dashboard
 * is served by the same Actix process that answers `/api`, so in production
 * the origin *is* the server. In development Vite proxies `/api`, `/auth` and
 * `/health` to it, so the origin is right there too -- and because the request
 * never leaves the origin, the session cookie stays first-party and no CORS
 * preflight is involved in either environment.
 *
 * `VITE_RUSTRAK_API_URL` is the escape hatch for a bundle hosted apart from
 * its server. Cross-origin then, and the instance has to allow credentials
 * from that origin.
 */
const baseUrl = import.meta.env.VITE_RUSTRAK_API_URL ?? window.location.origin;

/**
 * One client for the whole application.
 *
 * It holds configuration and a `ky` instance, nothing per-request and nothing
 * per-user: the session travels in a cookie the browser attaches itself. A
 * client per component would rebuild the retry and error-mapping layers on
 * every render for no gain.
 */
export const rustrak = new RustrakClient({ baseUrl });
