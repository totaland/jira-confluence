import { z } from 'zod';

export const JiraFieldMappingSchema = z.object({
  acceptance: z.string().optional(),
  epic: z.string().optional(),
  storyPoints: z.string().optional(),
  sprint: z.string().optional(),
});

export type JiraFieldMapping = z.infer<typeof JiraFieldMappingSchema>;

export const JiraApiVersionSchema = z.enum(['2', '3']).default('2');

export const JiraConfigSchema = z.object({
  apiVersion: JiraApiVersionSchema.optional(),
  defaultProject: z.string().optional(),
  fieldMapping: JiraFieldMappingSchema.optional(),
  epicStringFields: z.array(z.string()).optional(),
  acceptanceFieldCandidates: z.array(z.string()).optional(),
  epicFieldCandidates: z.array(z.string()).optional(),
});

export type JiraConfig = z.infer<typeof JiraConfigSchema>;

export const DEFAULT_JIRA_CONFIG: JiraConfig = {
  apiVersion: '2',
  fieldMapping: {},
  epicStringFields: [],
  acceptanceFieldCandidates: [],
  epicFieldCandidates: [],
};
