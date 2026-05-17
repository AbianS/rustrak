export interface Config {
  RUSTRAK_API_URL: string;
  RUSTRAK_API_TOKEN: string;
}

export function loadConfig(): Config {
  const url = process.env['RUSTRAK_API_URL'];
  if (!url) {
    console.error(
      '[rustrak-mcp] Missing required environment variable: RUSTRAK_API_URL. ' +
        'Set RUSTRAK_API_URL to the base URL of your Rustrak server.',
    );
    process.exit(1);
  }

  const token = process.env['RUSTRAK_API_TOKEN'];
  if (!token) {
    console.error(
      '[rustrak-mcp] Missing required environment variable: RUSTRAK_API_TOKEN. ' +
        'Set RUSTRAK_API_TOKEN to a valid Rustrak API token.',
    );
    process.exit(1);
  }

  return { RUSTRAK_API_URL: url, RUSTRAK_API_TOKEN: token };
}
