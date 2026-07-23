// Only `createKyInstance` is re-exported. `RustrakTransportFailure`,
// `isTransportFailure` and `transformHttpError` are internal to the hop between
// ky's `beforeError` hook and `BaseResource`, as `http.ts` states, and are
// imported from `./http.js` directly by the two places that may see them.
export { createKyInstance } from './http.js';
