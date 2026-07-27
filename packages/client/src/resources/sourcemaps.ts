import type { RustrakError } from '../errors.js';
import { Err, Ok, type Result } from '../result.js';
import {
  assembleInputSchema,
  assembleResponseSchema,
  chunkUploadCapabilitySchema,
  listSourceMapsResponseSchema,
} from '../schemas/sourcemap.js';
import type {
  AssembleInput,
  AssembleResponse,
  ChunkUploadCapability,
  ListSourceMapsResponse,
} from '../types/sourcemap.js';
import { BaseResource } from './base.js';

/**
 * Source Maps API resource
 *
 * Implements the sentry-cli artifact bundle protocol for source map upload
 * and the project source map listing endpoint.
 */
export class SourceMapsResource extends BaseResource {
  /**
   * Get chunk upload capabilities for an organization.
   * Returns the upload URL, chunk size limits, and accepted artifact types.
   */
  async getChunkUploadCapability(
    orgSlug: string,
  ): Promise<Result<ChunkUploadCapability, RustrakError>> {
    return this.request(
      () => this.http.get(`api/0/organizations/${orgSlug}/chunk-upload/`),
      chunkUploadCapabilitySchema,
    );
  }

  /**
   * Upload chunks as multipart/form-data, batching by `chunksPerRequest` (default 64).
   * Each part's field name must be the pre-computed SHA-1 hash of its content — the server
   * rejects mismatches with 400. Callers must supply the hash (also needed for assembleBundle).
   */
  async uploadChunks(
    orgSlug: string,
    chunks: { hash: string; data: Blob }[],
    chunksPerRequest = 64,
  ): Promise<Result<void, RustrakError>> {
    // A caller-supplied batch size, checked before anything is sent: the
    // matrix's `invalid_request` row, not a thrown programming error.
    if (!Number.isInteger(chunksPerRequest) || chunksPerRequest <= 0) {
      return Err({
        kind: 'invalid_request',
        message: 'chunksPerRequest must be a positive integer.',
      });
    }

    for (let i = 0; i < chunks.length; i += chunksPerRequest) {
      const batch = chunks.slice(i, i + chunksPerRequest);
      const form = new FormData();
      for (const chunk of batch) {
        form.append(chunk.hash, chunk.data);
      }

      const uploaded = await this.requestVoid(() =>
        this.http.post(`api/0/organizations/${orgSlug}/chunk-upload/`, {
          body: form,
        }),
      );

      // Stop at the first failed batch: continuing would keep pushing bytes at
      // a server that has already refused, and the caller has to retry anyway.
      if (!uploaded.success) {
        return uploaded;
      }
    }

    return Ok(undefined);
  }

  /**
   * Trigger assembly of a previously uploaded artifact bundle.
   *
   * @returns The assembly state. Poll until `state === "ok"` or `state === "error"`.
   *          When `state === "not_found"` the `missingChunks` array lists what
   *          still needs uploading via `uploadChunks`.
   */
  async assembleBundle(
    orgSlug: string,
    input: AssembleInput,
  ): Promise<Result<AssembleResponse, RustrakError>> {
    const validatedInput = this.validateInput(input, assembleInputSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () =>
        this.http.post(
          `api/0/organizations/${orgSlug}/artifactbundle/assemble/`,
          { json: validatedInput.data },
        ),
      assembleResponseSchema,
    );
  }

  /**
   * List all source map files uploaded for a project.
   */
  async list(
    orgSlug: string,
    projectSlug: string,
  ): Promise<Result<ListSourceMapsResponse, RustrakError>> {
    return this.request(
      () =>
        this.http.get(
          `api/0/projects/${orgSlug}/${projectSlug}/files/source-maps/`,
        ),
      listSourceMapsResponseSchema,
    );
  }
}
