import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { registerAlertTools } from './tools/alerts.js';
import { registerEventTools } from './tools/events.js';
import { registerIssueTools } from './tools/issues.js';
import { registerProjectTools } from './tools/projects.js';
import { registerTokenTools } from './tools/tokens.js';

export function createServer(client: RustrakClient): McpServer {
  const server = new McpServer({
    name: 'rustrak-mcp',
    version: '0.1.0',
  });

  registerProjectTools(server, client);
  registerIssueTools(server, client);
  registerEventTools(server, client);
  registerTokenTools(server, client);
  registerAlertTools(server, client);

  return server;
}
