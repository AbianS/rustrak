import {
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
  ): Promise<ChunkUploadCapability> {
    const data = await this.http
      .get(`api/0/organizations/${orgSlug}/chunk-upload/`)
      .json();
    return this.validate(data, chunkUploadCapabilitySchema);
  }

  /**
   * Upload one or more chunks as multipart/form-data.
   * Each chunk must be a `file` field; the server computes the SHA-1 and
   * stores the data. Returns once all chunks are persisted.
   */
  async uploadChunks(orgSlug: string, chunks: Blob[]): Promise<void> {
    const form = new FormData();
    for (const chunk of chunks) {
      form.append('file', chunk);
    }
    await this.http.post(`api/0/organizations/${orgSlug}/chunk-upload/`, {
      body: form,
    });
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
  ): Promise<AssembleResponse> {
    const data = await this.http
      .post(`api/0/organizations/${orgSlug}/artifactbundle/assemble/`, {
        json: input,
      })
      .json();
    return this.validate(data, assembleResponseSchema);
  }

  /**
   * List all source map files uploaded for a project.
   */
  async list(
    orgSlug: string,
    projectSlug: string,
  ): Promise<ListSourceMapsResponse> {
    const data = await this.http
      .get(`api/0/projects/${orgSlug}/${projectSlug}/files/source-maps/`)
      .json();
    return this.validate(data, listSourceMapsResponseSchema);
  }
}
