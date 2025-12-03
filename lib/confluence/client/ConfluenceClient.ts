import * as confluenceModule from 'confluence.js';
import { AppError } from '../../error.js';
import { withRetry, isRetryableError, type RetryOptions } from '../../core/retry.js';
import { withCircuitBreaker, type CircuitBreakerOptions } from '../../core/circuitBreaker.js';
import type {
  ConfluencePage,
  ConfluenceSearchResult,
  GetPageParams,
  SearchParams,
  CreatePageParams,
  UpdatePageParams,
  GetContentParams,
} from './types.js';

const CONFLUENCE_SERVICE_NAME = 'confluence';

interface ConfluenceContentApi {
  getContentById(params: {
    id: string;
    expand?: string[];
  }): Promise<ConfluencePage>;
  getContent(params: {
    spaceKey: string;
    title: string;
    expand?: string[];
    limit?: number;
  }): Promise<{ results: ConfluencePage[] }>;
  updateContent(payload: unknown): Promise<ConfluencePage>;
  createContent(payload: unknown): Promise<ConfluencePage>;
  searchContentByCQL(params: {
    cql: string;
    limit?: number;
    expand?: string[];
  }): Promise<ConfluenceSearchResult>;
}

interface UnderlyingConfluenceClient {
  content: ConfluenceContentApi;
}

type ConfluenceClientConstructor = new (config: Record<string, unknown>) => UnderlyingConfluenceClient;

const ConfluenceClientCtor: ConfluenceClientConstructor = (() => {
  const mod = confluenceModule as Record<string, unknown>;
  return (mod.ConfluenceClient ?? mod.Client ?? mod.default ?? mod) as ConfluenceClientConstructor;
})();

export interface ConfluenceClientConfig {
  baseUrl: string;
  auth:
    | { type: 'bearer'; token: string }
    | { type: 'basic'; email: string; apiToken: string };
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

export interface ConfluenceErrorResponse {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      message?: string;
      reason?: string;
    };
  };
  status?: number;
  message?: string;
}

export function isConfluenceErrorResponse(error: unknown): error is ConfluenceErrorResponse {
  return typeof error === 'object' && error !== null && 'message' in error;
}

export function getConfluenceErrorStatus(error: unknown): number | undefined {
  if (!isConfluenceErrorResponse(error)) {
    return undefined;
  }
  return error.response?.status ?? error.status;
}

export function isRetryableConfluenceError(error: unknown): boolean {
  if (isRetryableError(error)) {
    return true;
  }

  const status = getConfluenceErrorStatus(error);
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }

  return false;
}

export function normalizeConfluenceError(error: unknown): AppError {
  if (AppError.isAppError(error)) {
    return error;
  }

  if (!isConfluenceErrorResponse(error)) {
    return AppError.unknown('Unknown Confluence error', error);
  }

  const status = getConfluenceErrorStatus(error);
  const responseData = error.response?.data;

  const message =
    responseData?.message ?? responseData?.reason ?? error.message ?? 'Confluence API error';

  return AppError.confluenceApi(message, status, error);
}

function createUnderlyingClient(config: ConfluenceClientConfig): UnderlyingConfluenceClient {
  if (typeof ConfluenceClientCtor !== 'function') {
    throw AppError.config('Unable to resolve Confluence client constructor from confluence.js');
  }

  const clientConfig: Record<string, unknown> = {
    host: config.baseUrl,
    apiPrefix: '/rest',
  };

  if (config.auth.type === 'bearer') {
    clientConfig.authentication = {
      oauth2: { accessToken: config.auth.token },
    };
    clientConfig.personalAccessToken = config.auth.token;
    clientConfig.accessToken = config.auth.token;
    clientConfig.token = config.auth.token;
  } else {
    clientConfig.authentication = {
      basic: { email: config.auth.email, apiToken: config.auth.apiToken },
    };
    clientConfig.username = config.auth.email;
    clientConfig.password = config.auth.apiToken;
  }

  return new ConfluenceClientCtor(clientConfig);
}

export class ConfluenceClient {
  private readonly client: UnderlyingConfluenceClient;
  private readonly retryOptions: RetryOptions;
  private readonly circuitBreakerOptions: CircuitBreakerOptions;

  constructor(config: ConfluenceClientConfig) {
    this.client = createUnderlyingClient(config);

    this.retryOptions = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      shouldRetry: isRetryableConfluenceError,
      ...config.retry,
    };

    this.circuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      shouldTrip: isRetryableConfluenceError,
      ...config.circuitBreaker,
    };
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await withCircuitBreaker(
        CONFLUENCE_SERVICE_NAME,
        () => withRetry(operation, this.retryOptions),
        this.circuitBreakerOptions
      );
    } catch (error) {
      throw normalizeConfluenceError(error);
    }
  }

  async getPageById(id: string, params: GetPageParams = {}): Promise<ConfluencePage> {
    const expand = params.expand ?? ['body.storage', 'version'];

    return this.execute(async () => {
      return await this.client.content.getContentById({ id, expand });
    });
  }

  async getPageByTitle(params: GetContentParams): Promise<ConfluencePage | null> {
    const expand = params.expand ?? ['body.storage', 'version'];

    return this.execute(async () => {
      const result = await this.client.content.getContent({
        spaceKey: params.spaceKey,
        title: params.title,
        limit: params.limit ?? 1,
        expand,
      });

      if (!result.results.length) {
        return null;
      }

      return result.results[0];
    });
  }

  async search(params: SearchParams): Promise<ConfluenceSearchResult> {
    const expand = params.expand ?? ['version'];

    return this.execute(async () => {
      return await this.client.content.searchContentByCQL({
        cql: params.cql,
        limit: params.limit ?? 10,
        expand,
      });
    });
  }

  async createPage(params: CreatePageParams): Promise<ConfluencePage> {
    return this.execute(async () => {
      const payload: {
        type: string;
        title: string;
        space: { key: string };
        body: {
          storage: {
            value: string;
            representation: 'storage';
          };
        };
        ancestors?: Array<{ id: string }>;
      } = {
        type: 'page',
        title: params.title,
        space: { key: params.spaceKey },
        body: {
          storage: {
            value: params.body,
            representation: 'storage',
          },
        },
      };

      if (params.parentId) {
        payload.ancestors = [{ id: params.parentId }];
      }

      return await this.client.content.createContent(payload);
    });
  }

  async updatePage(id: string, currentPage: ConfluencePage, params: UpdatePageParams): Promise<ConfluencePage> {
    return this.execute(async () => {
      const payload: {
        id: string;
        type: string;
        title: string;
        version: { number: number };
        body: unknown;
      } = {
        id,
        type: currentPage.type,
        title: params.title ?? currentPage.title,
        version: {
          number: params.version ?? currentPage.version.number + 1,
        },
        body: currentPage.body,
      };

      if (params.body !== undefined) {
        payload.body = {
          storage: {
            value: params.body,
            representation: 'storage',
          },
        };
      }

      return await this.client.content.updateContent(payload);
    });
  }

  getUnderlyingClient(): UnderlyingConfluenceClient {
    return this.client;
  }
}

export interface CreateConfluenceClientFromEnvOptions {
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

export function createConfluenceClientFromEnv(
  options: CreateConfluenceClientFromEnvOptions = {}
): ConfluenceClient {
  const baseUrl = process.env.CONFLUENCE_BASE_URL ?? process.env.CONFLUENCE_HOST;

  if (!baseUrl) {
    throw AppError.config('Missing CONFLUENCE_BASE_URL environment variable (or legacy CONFLUENCE_HOST).');
  }

  const authMode = (process.env.CONFLUENCE_AUTH_MODE ?? 'bearer').toLowerCase();

  if (authMode === 'bearer') {
    const token =
      process.env.CONFLUENCE_BEARER_TOKEN ??
      process.env.CONFLUENCE_ACCESS_TOKEN ??
      process.env.CONFLUENCE_TOKEN;

    if (!token) {
      throw AppError.config(
        'Missing Confluence bearer token. Set CONFLUENCE_BEARER_TOKEN (or CONFLUENCE_ACCESS_TOKEN / CONFLUENCE_TOKEN).'
      );
    }

    return new ConfluenceClient({
      baseUrl,
      auth: { type: 'bearer', token },
      retry: options.retry,
      circuitBreaker: options.circuitBreaker,
    });
  }

  if (authMode === 'basic') {
    const email = process.env.CONFLUENCE_EMAIL ?? process.env.CONFLUENCE_USERNAME;
    const apiToken =
      process.env.CONFLUENCE_API_TOKEN ??
      process.env.CONFLUENCE_PASSWORD ??
      process.env.CONFLUENCE_TOKEN;

    if (!email || !apiToken) {
      throw AppError.config(
        'Basic auth for Confluence requires CONFLUENCE_EMAIL (or CONFLUENCE_USERNAME) and CONFLUENCE_API_TOKEN (or CONFLUENCE_PASSWORD / CONFLUENCE_TOKEN).'
      );
    }

    return new ConfluenceClient({
      baseUrl,
      auth: { type: 'basic', email, apiToken },
      retry: options.retry,
      circuitBreaker: options.circuitBreaker,
    });
  }

  throw AppError.config(`Unsupported CONFLUENCE_AUTH_MODE "${authMode}". Use "bearer" or "basic".`);
}
