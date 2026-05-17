export interface Config {
  RUSTRAK_API_URL: string;
  RUSTRAK_API_TOKEN: string;
}

export function loadConfig(): Config {
  const url = process.env['RUSTRAK_API_URL'];
  if (!url) {
    throw new Error(
      'Missing required environment variable: RUSTRAK_API_URL. ' +
        'Set RUSTRAK_API_URL to the base URL of your Rustrak server.',
    );
  }

  const token = process.env['RUSTRAK_API_TOKEN'];
  if (!token) {
    throw new Error(
      'Missing required environment variable: RUSTRAK_API_TOKEN. ' +
        'Set RUSTRAK_API_TOKEN to a valid Rustrak API token.',
    );
  }

  return { RUSTRAK_API_URL: url, RUSTRAK_API_TOKEN: token };
}
