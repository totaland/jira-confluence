export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts) {
        break;
      }

      if (!shouldRetry(error, attempt)) {
        break;
      }

      const delayMs = calculateBackoff(attempt, baseDelayMs, maxDelayMs);

      if (onRetry) {
        onRetry(error, attempt, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const networkCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code && networkCodes.includes(errorWithCode.code)) {
      return true;
    }

    const networkMessages = ['network error', 'socket hang up', 'connection refused'];
    if (networkMessages.some((msg) => error.message.toLowerCase().includes(msg))) {
      return true;
    }
  }

  return false;
}

export function isRetryableStatusCode(statusCode: number | undefined): boolean {
  if (statusCode === undefined) {
    return false;
  }
  return statusCode === 429 || statusCode === 503 || statusCode === 502 || statusCode === 504;
}

interface HttpErrorLike {
  response?: { status?: number };
  status?: number;
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const httpError = error as HttpErrorLike;
  return httpError.response?.status ?? httpError.status;
}

export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }

  const statusCode = getStatusCode(error);
  if (isRetryableStatusCode(statusCode)) {
    return true;
  }

  return false;
}

export function createDefaultShouldRetry(): (error: unknown, attempt: number) => boolean {
  return (error: unknown) => isRetryableError(error);
}
