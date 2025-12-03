import { AppError } from '../../error.js';
import { getJiraConfig } from '../../config/loadJiraConfig.js';
import type { JiraConfig } from '../../config/jira.js';
import type { JiraClient } from '../client/JiraClient.js';
import type { JiraField } from '../client/types.js';

export type LogicalFieldName = 'acceptance' | 'epic' | 'storyPoints' | 'sprint';

export interface FieldServiceConfig {
  jiraConfig?: JiraConfig;
  client?: JiraClient;
}

export class FieldService {
  private readonly config: JiraConfig;
  private readonly client?: JiraClient;
  private cachedFields: JiraField[] | null = null;

  constructor(options: FieldServiceConfig = {}) {
    this.config = options.jiraConfig ?? getJiraConfig();
    this.client = options.client;
  }

  async resolveFieldId(logicalName: LogicalFieldName): Promise<string | undefined> {
    const configuredId = this.config.fieldMapping?.[logicalName];
    if (configuredId) {
      return configuredId;
    }

    return this.discoverFieldId(logicalName);
  }

  async assertFieldId(logicalName: LogicalFieldName): Promise<string> {
    const fieldId = await this.resolveFieldId(logicalName);
    if (!fieldId) {
      throw AppError.validation(`Unable to resolve field ID for "${logicalName}". Configure it in jira.config.json or ensure the field exists in Jira.`, {
        logicalName,
      });
    }
    return fieldId;
  }

  private async discoverFieldId(logicalName: LogicalFieldName): Promise<string | undefined> {
    const fields = await this.getFields();
    if (!fields.length) {
      return undefined;
    }

    const candidates = this.getCandidatesForField(logicalName);
    const patterns = this.getPatternsForField(logicalName);

    for (const candidate of candidates) {
      const field = fields.find(
        (f) => f.name.toLowerCase() === candidate.toLowerCase() || f.id.toLowerCase() === candidate.toLowerCase()
      );
      if (field) {
        return field.id;
      }
    }

    for (const pattern of patterns) {
      const field = fields.find((f) => pattern.test(f.name));
      if (field) {
        return field.id;
      }
    }

    return undefined;
  }

  private getCandidatesForField(logicalName: LogicalFieldName): string[] {
    switch (logicalName) {
      case 'acceptance':
        return this.config.acceptanceFieldCandidates ?? [
          'Acceptance Criteria',
          'acceptanceCriteria',
          'Acceptance',
        ];
      case 'epic':
        return this.config.epicFieldCandidates ?? [
          'Epic Link',
          'epicLink',
          'Parent Link',
          'Epic',
        ];
      case 'storyPoints':
        return ['Story Points', 'storyPoints', 'Story point estimate'];
      case 'sprint':
        return ['Sprint', 'Sprints'];
      default:
        return [];
    }
  }

  private getPatternsForField(logicalName: LogicalFieldName): RegExp[] {
    switch (logicalName) {
      case 'acceptance':
        return [/acceptance\s*criteria/i, /acceptance/i];
      case 'epic':
        return [/epic\s*link/i, /parent\s*link/i];
      case 'storyPoints':
        return [/story\s*point/i, /point\s*estimate/i];
      case 'sprint':
        return [/sprint/i];
      default:
        return [];
    }
  }

  private async getFields(): Promise<JiraField[]> {
    if (this.cachedFields) {
      return this.cachedFields;
    }

    if (!this.client) {
      return [];
    }

    try {
      this.cachedFields = await this.client.listFields();
      return this.cachedFields;
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.cachedFields = null;
  }
}
