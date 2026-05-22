import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

const BASE_URL = 'http://localhost:8080';

describe('SourceMapsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: BASE_URL,
      token: 'test-token',
    });
  });

  describe('getChunkUploadCapability()', () => {
    it('should return upload URL and limits', async () => {
      const caps = await client.sourceMaps.getChunkUploadCapability('my-org');

      expect(caps.url).toContain('my-org');
      expect(caps.chunkSize).toBe(2097152);
      expect(caps.chunksPerRequest).toBe(64);
      expect(caps.maxRequestSize).toBe(33554432);
      expect(caps.hashAlgorithm).toBe('sha1');
      expect(caps.accept).toContain('artifact_bundles');
    });

    it('should validate response schema', async () => {
      server.use(
        http.get(`${BASE_URL}/api/0/organizations/bad-org/chunk-upload/`, () =>
          HttpResponse.json({ unexpected: true }),
        ),
      );

      await expect(
        client.sourceMaps.getChunkUploadCapability('bad-org'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('uploadChunks()', () => {
    it('should upload chunks without error', async () => {
      const chunk = new Blob(['source map data'], {
        type: 'application/octet-stream',
      });
      await expect(
        client.sourceMaps.uploadChunks('my-org', [chunk]),
      ).resolves.toBeUndefined();
    });

    it('should upload multiple chunks', async () => {
      const chunks = [
        new Blob(['chunk1']),
        new Blob(['chunk2']),
        new Blob(['chunk3']),
      ];
      await expect(
        client.sourceMaps.uploadChunks('my-org', chunks),
      ).resolves.toBeUndefined();
    });
  });

  describe('assembleBundle()', () => {
    it('should return ok state when all chunks are present', async () => {
      const result = await client.sourceMaps.assembleBundle('my-org', {
        checksum: 'abc123',
        chunks: ['sha1hash1', 'sha1hash2'],
        projects: ['my-project'],
      });

      expect(result.state).toBe('ok');
      expect(result.missingChunks).toHaveLength(0);
    });

    it('should return not_found with missing chunks', async () => {
      const result = await client.sourceMaps.assembleBundle('my-org', {
        checksum: 'missing-abc123',
        chunks: ['sha1hash1', 'sha1hash2'],
        projects: ['my-project'],
      });

      expect(result.state).toBe('not_found');
      expect(result.missingChunks.length).toBeGreaterThan(0);
    });

    it('should throw BadRequestError when projects array is empty', async () => {
      await expect(
        client.sourceMaps.assembleBundle('my-org', {
          checksum: 'abc123',
          chunks: ['sha1hash1'],
          projects: [],
        }),
      ).rejects.toThrow();
    });

    it('should validate response schema', async () => {
      server.use(
        http.post(
          `${BASE_URL}/api/0/organizations/bad-org/artifactbundle/assemble/`,
          () => HttpResponse.json({ unexpected: true }),
        ),
      );

      await expect(
        client.sourceMaps.assembleBundle('bad-org', {
          checksum: 'abc',
          chunks: [],
          projects: ['p'],
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('list()', () => {
    it('should return list of source map files', async () => {
      const result = await client.sourceMaps.list('my-org', 'my-project');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.debugId).toBe(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
      expect(result.data[0]?.fileType).toBe('source_map');
      expect(result.data[0]?.size).toBe(15234);
      expect(result.data[0]?.timesUsed).toBe(3);
    });

    it('should throw NotFoundError for unknown project', async () => {
      await expect(
        client.sourceMaps.list('my-org', 'not-found'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should validate response schema', async () => {
      server.use(
        http.get(
          `${BASE_URL}/api/0/projects/my-org/bad-project/files/source-maps/`,
          () => HttpResponse.json({ wrong: 'shape' }),
        ),
      );

      await expect(
        client.sourceMaps.list('my-org', 'bad-project'),
      ).rejects.toThrow(ValidationError);
    });
  });
});
