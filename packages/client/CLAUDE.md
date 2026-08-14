# @rustrak/client

Type-safe TypeScript client for the Rustrak REST API, usable from Node, Next.js
or a browser. ky for HTTP, Zod for runtime validation, tsup for the build,
Vitest and MSW for tests. Node >= 20, strict TypeScript with
`noUncheckedIndexedAccess`. Root context: `/CLAUDE.md`.

## The one invariant: no exceptions

Every method returns a `Result<T, RustrakError>`:

```ts
type Result<T, E> =
  | { readonly success: true;  readonly data: T }
  | { readonly success: false; readonly error: E }
```

The shape mirrors Zod's `safeParse`. Everything inside is a plain object with
`Object.prototype`: no class instances, no methods, and the operations are
standalone functions rather than methods. That is not stylistic. React's Flight
serializer refuses to send anything else across the server/client boundary, so a
failure that crosses from a Server Component to the browser has to survive
`structuredClone`. A thrown `Error` subclass does not.

`RustrakError` is a discriminated union keyed on `kind`, covering the transport
(`network`, `invalid_response`), the request (`invalid_request`, `validation`),
authorization (`unauthenticated`, `forbidden`), and the response status
(`not_found`, `conflict`, `gone`, `rate_limited`, `payload_too_large`,
`client_error`, `server_error`). `isRetryable` decides retries from the kind.

`unwrap` exists but nothing inside the client calls it. It is the caller
explicitly opting back into exceptions.

## Layout

```
src/
├── index.ts       public API surface
├── client.ts      RustrakClient, holds config and composes the resources
├── config.ts      ClientConfig
├── result.ts      Result, Ok, Err, unwrap, unwrapOr, mapResult
├── errors.ts      the RustrakError union and isRetryable
├── schemas/       Zod schemas. The source of truth.
├── types/         types inferred from the schemas, never written by hand
└── resources/     one class per API resource
    └── base.ts    BaseResource: the single ky to Result boundary
```

Schemas come first and types are inferred from them, so validation and the type
can never drift apart.

## Adding a resource

1. Write the Zod schema in `schemas/`, infer the type in `types/`.
2. Add the resource class in `resources/`, extending `BaseResource` so error
   mapping and retries come for free.
3. Expose it on `RustrakClient`.
4. Add MSW handlers and cover both the success and the failure path.

The failure path is not optional. A resource that only tests success has not
been tested, because the whole point of the package is the error half.

## Tests

```bash
pnpm --filter=@rustrak/client test
pnpm --filter=@rustrak/client test:coverage
```

MSW intercepts at the network layer, so tests exercise the real ky pipeline
rather than a mocked client.
