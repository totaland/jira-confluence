import { z } from 'zod';
import { AppError } from '../../error.js';
import type { JiraClient } from '../client/JiraClient.js';
import type { JiraIssue, JiraCreateIssueResponse } from '../client/types.js';
import { FieldService } from './FieldService.js';
import { formatAcceptanceAsTable } from '../utils.js';

export const CreateIssueInputSchema = z.object({
  project: z.string().min(1, 'Project key is required'),
  issueType: z.string().min(1, 'Issue type is required'),
  summary: z.string().min(1, 'Summary is required'),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  acceptance: z.string().optional(),
  epic: z.string().optional(),
  storyPoints: z.number().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

export const UpdateIssueInputSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  labels: z.array(z.string()).optional(),
  acceptance: z.string().optional(),
  epic: z.string().optional(),
  storyPoints: z.number().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateIssueInput = z.infer<typeof UpdateIssueInputSchema>;

export interface IssueServiceConfig {
  client: JiraClient;
  fieldService?: FieldService;
  formatAcceptanceAsTable?: boolean;
}

export class IssueService {
  private readonly client: JiraClient;
  private readonly fieldService: FieldService;
  private readonly formatAcceptance: boolean;

  constructor(config: IssueServiceConfig) {
    this.client = config.client;
    this.fieldService = config.fieldService ?? new FieldService({ client: config.client });
    this.formatAcceptance = config.formatAcceptanceAsTable ?? true;
  }

  async createIssue(input: CreateIssueInput): Promise<JiraCreateIssueResponse> {
    const validated = CreateIssueInputSchema.safeParse(input);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw AppError.validation(`Invalid issue input: ${issues}`);
    }

    const fields = await this.buildCreatePayload(validated.data);
    return this.client.createIssue({ fields });
  }

  async updateIssue(issueKey: string, updates: UpdateIssueInput): Promise<void> {
    const validated = UpdateIssueInputSchema.safeParse(updates);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw AppError.validation(`Invalid update input: ${issues}`);
    }

    const fields = await this.buildUpdatePayload(validated.data);
    if (Object.keys(fields).length === 0) {
      return;
    }

    await this.client.updateIssue(issueKey, { fields });
  }

  async getIssue(issueKey: string, expand?: string[]): Promise<JiraIssue> {
    return this.client.getIssue(issueKey, { expand });
  }

  private async buildCreatePayload(input: CreateIssueInput): Promise<Record<string, unknown>> {
    const fields: Record<string, unknown> = {
      project: { key: input.project },
      issuetype: { name: input.issueType },
      summary: input.summary,
    };

    if (input.description) {
      fields.description = input.description;
    }

    if (input.assignee) {
      fields.assignee = { name: input.assignee };
    }

    if (input.priority) {
      fields.priority = { name: input.priority };
    }

    if (input.labels?.length) {
      fields.labels = input.labels;
    }

    if (input.acceptance) {
      const acceptanceFieldId = await this.fieldService.resolveFieldId('acceptance');
      if (acceptanceFieldId) {
        const value = this.formatAcceptance
          ? formatAcceptanceAsTable(input.acceptance) ?? input.acceptance
          : input.acceptance;
        fields[acceptanceFieldId] = value;
      }
    }

    if (input.epic) {
      const epicFieldId = await this.fieldService.resolveFieldId('epic');
      if (epicFieldId) {
        fields[epicFieldId] = input.epic;
      }
    }

    if (input.storyPoints !== undefined) {
      const storyPointsFieldId = await this.fieldService.resolveFieldId('storyPoints');
      if (storyPointsFieldId) {
        fields[storyPointsFieldId] = input.storyPoints;
      }
    }

    if (input.customFields) {
      Object.assign(fields, input.customFields);
    }

    return fields;
  }

  private async buildUpdatePayload(input: UpdateIssueInput): Promise<Record<string, unknown>> {
    const fields: Record<string, unknown> = {};

    if (input.summary !== undefined) {
      fields.summary = input.summary;
    }

    if (input.description !== undefined) {
      fields.description = input.description;
    }

    if (input.assignee !== undefined) {
      fields.assignee = input.assignee ? { name: input.assignee } : null;
    }

    if (input.priority !== undefined) {
      fields.priority = { name: input.priority };
    }

    if (input.labels !== undefined) {
      fields.labels = input.labels;
    }

    if (input.acceptance !== undefined) {
      const acceptanceFieldId = await this.fieldService.resolveFieldId('acceptance');
      if (acceptanceFieldId) {
        const value = this.formatAcceptance
          ? formatAcceptanceAsTable(input.acceptance) ?? input.acceptance
          : input.acceptance;
        fields[acceptanceFieldId] = value;
      }
    }

    if (input.epic !== undefined) {
      const epicFieldId = await this.fieldService.resolveFieldId('epic');
      if (epicFieldId) {
        fields[epicFieldId] = input.epic || null;
      }
    }

    if (input.storyPoints !== undefined) {
      const storyPointsFieldId = await this.fieldService.resolveFieldId('storyPoints');
      if (storyPointsFieldId) {
        fields[storyPointsFieldId] = input.storyPoints;
      }
    }

    if (input.customFields) {
      Object.assign(fields, input.customFields);
    }

    return fields;
  }
}
