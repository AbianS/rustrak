import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';

describe('ReleasesResource', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('newIssues()', () => {
    it('returns issues first seen in the given release', async () => {
      const result = await client.releases.newIssues(1, '1.0.0');

      expect(result).toHaveLength(2);
      expect(result[0].short_id).toBe('TEST-1');
    });

    it('passes a limit query param without error', async () => {
      const result = await client.releases.newIssues(1, '1.0.0', 5);
      expect(result).toHaveLength(2);
    });
  });
});
