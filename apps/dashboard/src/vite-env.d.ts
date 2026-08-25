/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the API lives, when it is not the origin serving this bundle.
   *
   * Left unset in both real deployments: in production the Rust server hands
   * out these files itself, and in development Vite proxies the API prefixes
   * across. It exists for the third case -- a dashboard built once and pointed
   * at an instance somewhere else -- and that one needs the server's CORS to
   * allow credentials, which is why it is not the default.
   */
  readonly VITE_RUSTRAK_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
