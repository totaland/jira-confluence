import { Version2Client, Version3Client } from 'jira.js';
import { AppError } from '../../error.js';
import { withRetry, isRetryableError, type RetryOptions } from '../../core/retry.js';
import { withCircuitBreaker, type CircuitBreakerOptions } from '../../core/circuitBreaker.js';
import type {
  JiraIssue,
  JiraSearchResult,
  JiraField,
  JiraCreateIssueResponse,
  GetIssueParams,
  SearchParams,
  CreateIssueParams,
  UpdateIssueParams,
} from './types.js';

export type JiraApiVersion = '2' | '3';
export type UnderlyingClient = Version2Client | Version3Client;

const JIRA_SERVICE_NAME = 'jira';

export interface JiraClientConfig {
  baseUrl: string;
  auth:
    | { type: 'bearer'; token: string }
    | { type: 'basic'; email: string; apiToken: string };
  apiVersion?: JiraApiVersion;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

export interface JiraErrorResponse {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      errors?: Record<string, string>;
      errorMessages?: string[];
    };
  };
  status?: number;
  message?: string;
}

export function isJiraErrorResponse(error: unknown): error is JiraErrorResponse {
  return typeof error === 'object' && error !== null && 'message' in error;
}

export function getJiraErrorStatus(error: unknown): number | undefined {
  if (!isJiraErrorResponse(error)) {
    return undefined;
  }
  return error.response?.status ?? error.status;
}

export function isRetryableJiraError(error: unknown): boolean {
  if (isRetryableError(error)) {
    return true;
  }

  const status = getJiraErrorStatus(error);
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  return false;
}

export function normalizeJiraError(error: unknown): AppError {
  if (AppError.isAppError(error)) {
    return error;
  }

  if (!isJiraErrorResponse(error)) {
    return AppError.unknown('Unknown Jira error', error);
  }

  const status = getJiraErrorStatus(error);
  const responseData = error.response?.data;

  const messages: string[] = [];

  if (responseData?.errorMessages?.length) {
    messages.push(...responseData.errorMessages);
  }

  if (responseData?.errors) {
    for (const [field, msg] of Object.entries(responseData.errors)) {
      messages.push(`${field}: ${msg}`);
    }
  }

  const message = messages.length > 0 ? messages.join('; ') : error.message ?? 'Jira API error';

  return AppError.jiraApi(message, status, error);
}

function resolveApiVersion(baseUrl: string, override?: JiraApiVersion): JiraApiVersion {
  if (override) {
    return override;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname.endsWith('.atlassian.net')) {
      return '3';
    }
  } catch {
    // ignore parse errors
  }

  return '2';
}

function createUnderlyingClient(config: JiraClientConfig): UnderlyingClient {
  const apiVersion = resolveApiVersion(config.baseUrl, config.apiVersion);

  const clientConfig = {
    host: config.baseUrl,
    authentication:
      config.auth.type === 'bearer'
        ? { oauth2: { accessToken: config.auth.token } }
        : { basic: { email: config.auth.email, apiToken: config.auth.apiToken } },
  };

  return apiVersion === '3'
    ? new Version3Client(clientConfig)
    : new Version2Client(clientConfig);
}

export class JiraClient {
  private readonly client: UnderlyingClient;
  private readonly retryOptions: RetryOptions;
  private readonly circuitBreakerOptions: CircuitBreakerOptions;

  constructor(config: JiraClientConfig) {
    this.client = createUnderlyingClient(config);

    this.retryOptions = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      shouldRetry: isRetryableJiraError,
      ...config.retry,
    };

    this.circuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      shouldTrip: isRetryableJiraError,
      ...config.circuitBreaker,
    };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await withCircuitBreaker(
        JIRA_SERVICE_NAME,
        () => withRetry(operation, this.retryOptions),
        this.circuitBreakerOptions
      );
    } catch (error) {
      throw normalizeJiraError(error);
    }
  }

  async getIssue(issueIdOrKey: string, params: GetIssueParams = {}): Promise<JiraIssue> {
    const fields = Array.isArray(params.fields) ? params.fields : params.fields?.split(',');
    const expand = Array.isArray(params.expand) ? params.expand : params.expand?.split(',');

    return this.execute(async () => {
      const getIssueFn = this.client.issues.getIssue.bind(this.client.issues) as (
        params: { issueIdOrKey: string; fields?: string[]; expand?: string[] }
      ) => Promise<unknown>;
      const result = await getIssueFn({ issueIdOrKey, fields, expand });
      return result as JiraIssue;
    });
  }

  async search(params: SearchParams): Promise<JiraSearchResult> {
    const fields = Array.isArray(params.fields) ? params.fields : params.fields?.split(',');
    const expand = Array.isArray(params.expand) ? params.expand : params.expand?.split(',');

    return this.execute(async () => {
      const searchFn = this.client.issueSearch.searchForIssuesUsingJql.bind(
        this.client.issueSearch
      ) as (params: {
        jql: string;
        maxResults?: number;
        startAt?: number;
        fields?: string[];
        expand?: string[];
      }) => Promise<unknown>;

      const result = await searchFn({
        jql: params.jql,
        maxResults: params.maxResults,
        startAt: params.startAt,
        fields,
        expand,
      });

      if (typeof result === 'string') {
        if (result.trim().startsWith('<')) {
          throw AppError.jiraApi(
            'Jira search returned HTML (likely a login page). Verify authentication credentials.',
            401
          );
        }

        try {
          return JSON.parse(result) as JiraSearchResult;
        } catch (parseError) {
          throw AppError.jiraApi('Unexpected Jira search response format', undefined, parseError);
        }
      }

      return result as JiraSearchResult;
    });
  }

  async createIssue(params: CreateIssueParams): Promise<JiraCreateIssueResponse> {
    return this.execute(async () => {
      const createIssueFn = this.client.issues.createIssue.bind(this.client.issues) as (
        params: { fields: Record<string, unknown> }
      ) => Promise<unknown>;
      const result = await createIssueFn({ fields: params.fields });
      return result as JiraCreateIssueResponse;
    });
  }

  async updateIssue(issueIdOrKey: string, params: UpdateIssueParams): Promise<void> {
    return this.execute(async () => {
      const editIssueFn = this.client.issues.editIssue.bind(this.client.issues) as (
        params: {
          issueIdOrKey: string;
          fields?: Record<string, unknown>;
          update?: Record<string, unknown>;
        }
      ) => Promise<void>;
      await editIssueFn({
        issueIdOrKey,
        fields: params.fields,
        update: params.update,
      });
    });
  }

  async listFields(): Promise<JiraField[]> {
    return this.execute(async () => {
      const result = await this.client.issueFields.getFields();
      return result as unknown as JiraField[];
    });
  }

  async getTransitions(issueIdOrKey: string): Promise<{ id: string; name: string }[]> {
    return this.execute(async () => {
      const getTransitionsFn = this.client.issues.getTransitions.bind(this.client.issues) as (
        params: { issueIdOrKey: string }
      ) => Promise<{ transitions?: { id: string; name: string }[] }>;
      const result = await getTransitionsFn({ issueIdOrKey });
      return (result.transitions ?? []) as { id: string; name: string }[];
    });
  }

  async transitionIssue(issueIdOrKey: string, transitionId: string): Promise<void> {
    return this.execute(async () => {
      const doTransitionFn = this.client.issues.doTransition.bind(this.client.issues) as (
        params: { issueIdOrKey: string; transition: { id: string } }
      ) => Promise<void>;
      await doTransitionFn({
        issueIdOrKey,
        transition: { id: transitionId },
      });
    });
  }

  getUnderlyingClient(): UnderlyingClient {
    return this.client;
  }
}

export interface CreateJiraClientFromEnvOptions {
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

export function createJiraClientFromEnv(
  options: CreateJiraClientFromEnvOptions = {}
): JiraClient {
  const baseUrl = process.env.JIRA_BASE_URL ?? process.env.JIRA_HOST;

  if (!baseUrl) {
    throw AppError.config('Missing JIRA_BASE_URL environment variable (or legacy JIRA_HOST).');
  }

  const authMode = (process.env.JIRA_AUTH_MODE ?? 'bearer').toLowerCase();
  const versionOverride = (process.env.JIRA_API_VERSION ?? '').trim().toLowerCase();
  const apiVersion: JiraApiVersion | undefined =
    versionOverride === '3' || versionOverride === 'v3'
      ? '3'
      : versionOverride === '2' || versionOverride === 'v2'
        ? '2'
        : undefined;

  if (authMode === 'bearer') {
    const token =
      process.env.JIRA_BEARER_TOKEN ??
      process.env.JIRA_ACCESS_TOKEN ??
      process.env.JIRA_TOKEN;

    if (!token) {
      throw AppError.config(
        'Missing Jira bearer token. Set JIRA_BEARER_TOKEN (or JIRA_ACCESS_TOKEN / JIRA_TOKEN).'
      );
    }

    return new JiraClient({
      baseUrl,
      auth: { type: 'bearer', token },
      apiVersion,
      retry: options.retry,
      circuitBreaker: options.circuitBreaker,
    });
  }

  if (authMode === 'basic') {
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN ?? process.env.JIRA_PASSWORD;

    if (!email || !apiToken) {
      throw AppError.config(
        'Basic auth requires JIRA_EMAIL and JIRA_API_TOKEN (or JIRA_PASSWORD) environment variables.'
      );
    }

    return new JiraClient({
      baseUrl,
      auth: { type: 'basic', email, apiToken },
      apiVersion,
      retry: options.retry,
      circuitBreaker: options.circuitBreaker,
    });
  }

  throw AppError.config(`Unsupported JIRA_AUTH_MODE "${authMode}". Use "bearer" or "basic".`);
}
