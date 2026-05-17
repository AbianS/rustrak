import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

const EXPECTED_TOOLS = [
  // Projects (3)
  'list_projects',
  'get_project',
  'create_project',
  // Issues (6)
  'list_issues',
  'get_issue',
  'resolve_issue',
  'unresolve_issue',
  'mute_issue',
  'delete_issue',
  // Events (2)
  'list_events',
  'get_event',
  // Tokens (3)
  'list_tokens',
  'create_token',
  'revoke_token',
  // Alerts (3)
  'list_alert_channels',
  'test_alert_channel',
  'list_alert_rules',
] as const;

describe('MCP server integration', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;

  beforeEach(async () => {
    mockClient = {
      projects: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
      issues: {
        list: vi.fn(),
        get: vi.fn(),
        updateState: vi.fn(),
        delete: vi.fn(),
      },
      events: { list: vi.fn(), get: vi.fn() },
      tokens: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
      alertChannels: { list: vi.fn(), test: vi.fn() },
      alertRules: { list: vi.fn() },
    };
    testEnv = await createTestEnv(mockClient);
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  it(`registers all ${EXPECTED_TOOLS.length} tools`, async () => {
    const { tools } = await testEnv.mcpClient.listTools();
    const toolNames = tools.map((t: { name: string }) => t.name);

    for (const expected of EXPECTED_TOOLS) {
      expect(
        toolNames,
        `Expected tool "${expected}" to be registered`,
      ).toContain(expected);
    }

    expect(tools).toHaveLength(EXPECTED_TOOLS.length);
  });

  it('delete_issue has destructiveHint: true', async () => {
    const { tools } = await testEnv.mcpClient.listTools();
    const deleteIssue = tools.find(
      (t: { name: string }) => t.name === 'delete_issue',
    );
    expect(deleteIssue).toBeDefined();
    expect(deleteIssue?.annotations?.destructiveHint).toBe(true);
  });

  it('revoke_token has destructiveHint: true', async () => {
    const { tools } = await testEnv.mcpClient.listTools();
    const revokeToken = tools.find(
      (t: { name: string }) => t.name === 'revoke_token',
    );
    expect(revokeToken).toBeDefined();
    expect(revokeToken?.annotations?.destructiveHint).toBe(true);
  });
});
