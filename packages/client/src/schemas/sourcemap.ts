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
