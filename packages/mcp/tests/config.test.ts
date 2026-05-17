import { afterEach, describe, expect, it, vi } from 'vitest';

// We need to import loadConfig after setting env vars.
// Using dynamic import to re-evaluate per test.

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it('exits with code 1 when RUSTRAK_API_URL is missing', async () => {
    delete process.env['RUSTRAK_API_URL'];
    delete process.env['RUSTRAK_API_TOKEN'];
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementationOnce((_code?: string | number | null) => {
        throw new Error('process.exit');
      });
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('exits with code 1 when RUSTRAK_API_TOKEN is missing', async () => {
    process.env['RUSTRAK_API_URL'] = 'http://localhost:8080';
    delete process.env['RUSTRAK_API_TOKEN'];
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementationOnce((_code?: string | number | null) => {
        throw new Error('process.exit');
      });
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
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
