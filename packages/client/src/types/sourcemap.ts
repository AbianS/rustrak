import type { z } from 'zod';
import type {
  assembleResponseSchema,
  chunkUploadCapabilitySchema,
  listSourceMapsResponseSchema,
  sourceMapFileSchema,
} from '../schemas/sourcemap.js';

export type ChunkUploadCapability = z.infer<typeof chunkUploadCapabilitySchema>;
export type AssembleResponse = z.infer<typeof assembleResponseSchema>;
export type SourceMapFile = z.infer<typeof sourceMapFileSchema>;
export type ListSourceMapsResponse = z.infer<
  typeof listSourceMapsResponseSchema
>;

export interface AssembleInput {
  checksum: string;
  chunks: string[];
  projects: string[];
}
