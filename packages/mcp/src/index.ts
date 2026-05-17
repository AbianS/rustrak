import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RustrakClient } from '@rustrak/client';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const client = new RustrakClient({
  baseUrl: config.RUSTRAK_API_URL,
  token: config.RUSTRAK_API_TOKEN,
});
const server = createServer(client);
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[rustrak-mcp] Server started');
