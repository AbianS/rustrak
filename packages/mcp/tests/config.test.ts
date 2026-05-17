import { afterEach, describe, expect, it, vi } from 'vitest';

// We need to import loadConfig after setting env vars.
// Using dynamic import to re-evaluate per test.

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('throws when RUSTRAK_API_URL is missing', async () => {
    delete process.env['RUSTRAK_API_URL'];
    delete process.env['RUSTRAK_API_TOKEN'];
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow(/RUSTRAK_API_URL/);
  });

  it('throws when RUSTRAK_API_TOKEN is missing', async () => {
    process.env['RUSTRAK_API_URL'] = 'http://localhost:8080';
    delete process.env['RUSTRAK_API_TOKEN'];
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow(/RUSTRAK_API_TOKEN/);
  });

  it('returns config when both env vars are present', async () => {
    process.env['RUSTRAK_API_URL'] = 'http://localhost:8080';
    process.env['RUSTRAK_API_TOKEN'] = 'test-token-abc';
    const { loadConfig } = await import('../src/config.js');
    const config = loadConfig();
    expect(config.RUSTRAK_API_URL).toBe('http://localhost:8080');
    expect(config.RUSTRAK_API_TOKEN).toBe('test-token-abc');
  });
});
