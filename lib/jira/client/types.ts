import { z } from 'zod';

export const JiraUserSchema = z.object({
  accountId: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  active: z.boolean().optional(),
});

export type JiraUser = z.infer<typeof JiraUserSchema>;

export const JiraIssueTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  subtask: z.boolean().optional(),
});

export type JiraIssueType = z.infer<typeof JiraIssueTypeSchema>;

export const JiraStatusSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export type JiraStatus = z.infer<typeof JiraStatusSchema>;

export const JiraPrioritySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

export type JiraPriority = z.infer<typeof JiraPrioritySchema>;

export const JiraProjectSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
});

export type JiraProject = z.infer<typeof JiraProjectSchema>;

export const JiraCommentSchema = z.object({
  id: z.string().optional(),
  author: JiraUserSchema.nullable().optional(),
  created: z.string().optional(),
  body: z.unknown().optional(),
  renderedBody: z.unknown().optional(),
});

export type JiraComment = z.infer<typeof JiraCommentSchema>;

export const JiraIssueFieldsSchema = z.object({
  summary: z.string().optional(),
  description: z.unknown().optional(),
  issuetype: JiraIssueTypeSchema.nullable().optional(),
  status: JiraStatusSchema.nullable().optional(),
  reporter: JiraUserSchema.nullable().optional(),
  assignee: JiraUserSchema.nullable().optional(),
  priority: JiraPrioritySchema.nullable().optional(),
  project: JiraProjectSchema.nullable().optional(),
  duedate: z.string().nullable().optional(),
  labels: z.array(z.string()).nullable().optional(),
  fixVersions: z.array(z.object({ name: z.string().nullable().optional() })).nullable().optional(),
  comment: z.object({
    comments: z.array(JiraCommentSchema).nullable().optional(),
  }).nullable().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
}).passthrough();

export type JiraIssueFields = z.infer<typeof JiraIssueFieldsSchema>;

export const JiraIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().optional(),
  fields: JiraIssueFieldsSchema,
  names: z.record(z.string(), z.string()).optional(),
  renderedFields: z.object({
    description: z.unknown().optional(),
  }).passthrough().optional(),
}).passthrough();

export type JiraIssue = z.infer<typeof JiraIssueSchema>;

export const JiraSearchResultSchema = z.object({
  startAt: z.number().optional(),
  maxResults: z.number().optional(),
  total: z.number().optional(),
  issues: z.array(JiraIssueSchema).optional(),
});

export type JiraSearchResult = z.infer<typeof JiraSearchResultSchema>;

export const JiraFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  custom: z.boolean().optional(),
  orderable: z.boolean().optional(),
  navigable: z.boolean().optional(),
  searchable: z.boolean().optional(),
  clauseNames: z.array(z.string()).optional(),
  schema: z.object({
    type: z.string().optional(),
    items: z.string().optional(),
    system: z.string().optional(),
    custom: z.string().optional(),
    customId: z.number().optional(),
  }).optional(),
});

export type JiraField = z.infer<typeof JiraFieldSchema>;

export const JiraCreateIssueResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().optional(),
});

export type JiraCreateIssueResponse = z.infer<typeof JiraCreateIssueResponseSchema>;

export interface GetIssueParams {
  fields?: string | string[];
  expand?: string | string[];
}

export interface SearchParams {
  jql: string;
  maxResults?: number;
  startAt?: number;
  fields?: string | string[];
  expand?: string | string[];
}

export interface CreateIssueParams {
  fields: Record<string, unknown>;
}

export interface UpdateIssueParams {
  fields?: Record<string, unknown>;
  update?: Record<string, unknown>;
}
