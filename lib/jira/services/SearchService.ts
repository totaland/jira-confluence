import type { JiraClient } from '../client/JiraClient.js';
import type { JiraSearchResult, JiraIssue } from '../client/types.js';
import { buildCleanIssue, type CleanIssue, type BuildCleanIssueConfig } from '../utils.js';

export interface SearchServiceConfig {
  client: JiraClient;
  baseUrl?: string;
  defaultLimit?: number;
}

export interface SearchOptions {
  limit?: number;
  startAt?: number;
  fields?: string[];
  expand?: string[];
}

export interface SearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export interface CleanSearchResult {
  issues: CleanIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_FIELDS = [
  'summary',
  'description',
  'issuetype',
  'status',
  'priority',
  'assignee',
  'reporter',
  'project',
  'labels',
  'created',
  'updated',
  'duedate',
  'fixVersions',
  'comment',
];

export class SearchService {
  private readonly client: JiraClient;
  private readonly baseUrl: string;
  private readonly defaultLimit: number;

  constructor(config: SearchServiceConfig) {
    this.client = config.client;
    this.baseUrl = config.baseUrl ?? process.env.JIRA_BASE_URL ?? '';
    this.defaultLimit = config.defaultLimit ?? DEFAULT_LIMIT;
  }

  async searchByJql(jql: string, options: SearchOptions = {}): Promise<SearchResult> {
    const result = await this.client.search({
      jql,
      maxResults: options.limit ?? this.defaultLimit,
      startAt: options.startAt,
      fields: options.fields ?? DEFAULT_FIELDS,
      expand: options.expand,
    });

    return this.normalizeResult(result);
  }

  async searchByText(text: string, options: SearchOptions = {}): Promise<SearchResult> {
    const escapedText = this.escapeJqlText(text);
    const jql = `text ~ "${escapedText}" ORDER BY updated DESC`;
    return this.searchByJql(jql, options);
  }

  async searchByProject(projectKey: string, options: SearchOptions = {}): Promise<SearchResult> {
    const jql = `project = "${projectKey}" ORDER BY updated DESC`;
    return this.searchByJql(jql, options);
  }

  async searchByAssignee(assignee: string, options: SearchOptions = {}): Promise<SearchResult> {
    const jql = assignee === 'currentUser()'
      ? 'assignee = currentUser() ORDER BY updated DESC'
      : `assignee = "${assignee}" ORDER BY updated DESC`;
    return this.searchByJql(jql, options);
  }

  async searchClean(jql: string, options: SearchOptions = {}): Promise<CleanSearchResult> {
    const result = await this.searchByJql(jql, options);

    const cleanConfig: BuildCleanIssueConfig = {
      baseUrl: this.baseUrl,
    };

    return {
      issues: result.issues.map((issue) => buildCleanIssue(issue, cleanConfig)),
      total: result.total,
      startAt: result.startAt,
      maxResults: result.maxResults,
    };
  }

  private normalizeResult(result: JiraSearchResult): SearchResult {
    return {
      issues: result.issues ?? [],
      total: result.total ?? 0,
      startAt: result.startAt ?? 0,
      maxResults: result.maxResults ?? 0,
    };
  }

  private escapeJqlText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
  }
}
