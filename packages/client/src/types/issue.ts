import type { z } from 'zod';
import type {
  activityEntrySchema,
  bulkDeleteIssuesSchema,
  bulkUpdateIssuesSchema,
  createCommentSchema,
  createDeploySchema,
  createUserReportSchema,
  issueAggregatesSchema,
  issueHashSchema,
  issuePrioritySchema,
  issueSchema,
  issueStatsSchema,
  issueStatsWindowSchema,
  issueStatusSchema,
  tagSummarySchema,
  tagValueCountSchema,
  tagValuesResponseSchema,
  updateIssueStateSchema,
  userReportSchema,
} from '../schemas/issue.js';

/** Issue resource from the API */
export type Issue = z.infer<typeof issueSchema>;

/** Canonical issue status */
export type IssueStatus = z.infer<typeof issueStatusSchema>;

/** Issue priority tier */
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

/** Request payload for updating issue state */
export type UpdateIssueState = z.infer<typeof updateIssueStateSchema>;

/** A grouping hash mapped to an issue */
export type IssueHash = z.infer<typeof issueHashSchema>;

/** A tag value with its event count */
export type TagValueCount = z.infer<typeof tagValueCountSchema>;

/** Distinct values for a tag key within an issue */
export type TagValuesResponse = z.infer<typeof tagValuesResponseSchema>;

/** A tag key with its top values */
export type TagSummary = z.infer<typeof tagSummarySchema>;

/** Per-issue aggregates (user count + top tags) */
export type IssueAggregates = z.infer<typeof issueAggregatesSchema>;

/** Event-count timeseries for an issue */
export type IssueStats = z.infer<typeof issueStatsSchema>;

/** An entry in an issue's activity log */
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

/** A user feedback report */
export type UserReport = z.infer<typeof userReportSchema>;

/** Request to add a comment (note) */
export type CreateComment = z.infer<typeof createCommentSchema>;

/** Request to submit user feedback */
export type CreateUserReport = z.infer<typeof createUserReportSchema>;

/** Request to bulk-mutate issues */
export type BulkUpdateIssues = z.infer<typeof bulkUpdateIssuesSchema>;

/** Request to bulk-delete issues */
export type BulkDeleteIssues = z.infer<typeof bulkDeleteIssuesSchema>;

/** Request to record a deploy */
export type CreateDeploy = z.infer<typeof createDeploySchema>;

/** Time window for issue stats */
export type IssueStatsWindow = z.infer<typeof issueStatsWindowSchema>;
