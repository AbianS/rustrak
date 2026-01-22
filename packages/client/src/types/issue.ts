import type { z } from 'zod';
import type { issueSchema, updateIssueStateSchema } from '../schemas/issue.js';

/**
 * Issue resource from the API
 */
export type Issue = z.infer<typeof issueSchema>;

/**
 * Request payload for updating issue state
 */
export type UpdateIssueState = z.infer<typeof updateIssueStateSchema>;
