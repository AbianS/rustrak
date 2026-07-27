import { z } from 'zod';

export const chunkUploadCapabilitySchema = z.object({
  url: z.string(),
  chunkSize: z.number().int(),
  chunksPerRequest: z.number().int(),
  maxRequestSize: z.number().int(),
  hashAlgorithm: z.string(),
  accept: z.array(z.string()),
  concurrency: z.number().int().optional(),
});

/**
 * The assemble request body, mirroring `AssembleBody` in
 * `apps/server/src/routes/sourcemaps.rs`.
 *
 * `projects` is the one field the server rejects outright when empty
 * (`routes/sourcemaps.rs`, 400 "projects array must not be empty"), so the
 * check is made locally: a request that cannot succeed should not be sent.
 * `checksum` and the chunk hashes stay plain non-empty strings rather than a
 * SHA-1 pattern, because the server compares them against stored chunks and a
 * client-side format guess would reject inputs the server would have accepted.
 */
export const assembleInputSchema = z.object({
  checksum: z.string().min(1),
  chunks: z.array(z.string().min(1)),
  projects: z.array(z.string().min(1)).min(1),
});

export const assembleResponseSchema = z.object({
  state: z.string(),
  missingChunks: z.array(z.string()),
  detail: z.string().optional(),
});

export const sourceMapFileSchema = z.object({
  debugId: z.string(),
  fileType: z.string(),
  size: z.number().int(),
  timesUsed: z.number().int(),
  dateUploaded: z.string(),
});

export const listSourceMapsResponseSchema = z.object({
  data: z.array(sourceMapFileSchema),
});
