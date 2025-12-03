import { z } from 'zod';

/**
 * Schema for JSON-based issue input.
 * This provides a structured, validated way to create or update Jira issues.
 */

export const IssueInputSchema = z.object({
  project: z.string().min(1, 'Project key is required').optional(),
  issueType: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  summary: z.string().min(1, 'Summary is required').optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  epic: z.string().optional(),
  acceptance: z.union([z.string(), z.array(z.string())]).optional(),
  acceptanceField: z.string().optional(),
  epicField: z.string().optional(),
  storyPoints: z.number().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export type IssueInput = z.infer<typeof IssueInputSchema>;

export const CreateIssueInputSchema = IssueInputSchema.extend({
  project: z.string().min(1, 'Project key is required'),
  issueType: z.string().min(1, 'Issue type is required').optional(),
  type: z.string().min(1, 'Issue type is required').optional(),
  summary: z.string().min(1, 'Summary is required'),
}).refine(
  (data) => data.issueType !== undefined || data.type !== undefined,
  {
    message: 'Either issueType or type is required',
    path: ['issueType'],
  }
);

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

export const UpdateIssueInputSchema = IssueInputSchema.partial();

export type UpdateIssueInput = z.infer<typeof UpdateIssueInputSchema>;

/**
 * Normalizes issue input by handling aliases (type -> issueType, etc.)
 */
export function normalizeIssueInput(input: IssueInput): IssueInput {
  const normalized = { ...input };

  if (normalized.type && !normalized.issueType) {
    normalized.issueType = normalized.type;
    delete normalized.type;
  }

  if (normalized.fields && !normalized.customFields) {
    normalized.customFields = normalized.fields;
    delete normalized.fields;
  }

  if (typeof normalized.labels === 'string') {
    normalized.labels = normalized.labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  if (Array.isArray(normalized.acceptance)) {
    normalized.acceptance = normalized.acceptance.join('\n');
  }

  return normalized;
}
