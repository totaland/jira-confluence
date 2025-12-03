export const ErrorCode = {
  CONFIG_ERROR: 'CONFIG_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  JIRA_API_ERROR: 'JIRA_API_ERROR',
  CONFLUENCE_API_ERROR: 'CONFLUENCE_API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  statusCode?: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;
  readonly statusCode?: number;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.context = options.context;
    this.statusCode = options.statusCode;
  }

  static config(message: string, cause?: unknown): AppError {
    return new AppError({ code: ErrorCode.CONFIG_ERROR, message, cause });
  }

  static validation(message: string, context?: Record<string, unknown>): AppError {
    return new AppError({ code: ErrorCode.VALIDATION_ERROR, message, context });
  }

  static jiraApi(message: string, statusCode?: number, cause?: unknown): AppError {
    return new AppError({ code: ErrorCode.JIRA_API_ERROR, message, statusCode, cause });
  }

  static confluenceApi(message: string, statusCode?: number, cause?: unknown): AppError {
    return new AppError({ code: ErrorCode.CONFLUENCE_API_ERROR, message, statusCode, cause });
  }

  static network(message: string, cause?: unknown): AppError {
    return new AppError({ code: ErrorCode.NETWORK_ERROR, message, cause });
  }

  static circuitBreakerOpen(service: string): AppError {
    return new AppError({
      code: ErrorCode.CIRCUIT_BREAKER_OPEN,
      message: `Circuit breaker is open for ${service}. Service is temporarily unavailable.`,
      context: { service },
    });
  }

  static unknown(message: string, cause?: unknown): AppError {
    return new AppError({ code: ErrorCode.UNKNOWN_ERROR, message, cause });
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}

export interface HttpErrorLike {
  message: string;
  response?: {
    status: number;
    statusText?: string;
    data?: unknown;
  };
  request?: unknown;
}

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === 'object' && error !== null && 'message' in error;
}

function formatErrorDetails(error: AppError): string {
  const parts: string[] = [];

  if (error.statusCode) {
    parts.push(`Status: ${error.statusCode}`);
  }

  if (error.context && Object.keys(error.context).length > 0) {
    parts.push(`Context: ${JSON.stringify(error.context)}`);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

export function handleError(error: unknown): never {
  if (AppError.isAppError(error)) {
    const details = formatErrorDetails(error);
    console.error(`[${error.code}] ${error.message}${details}`);

    if (process.env.DEBUG && error.cause) {
      console.error('Cause:', error.cause);
    }

    process.exit(1);
  }

  if (!isHttpErrorLike(error)) {
    console.error(`[${ErrorCode.UNKNOWN_ERROR}] ${String(error)}`);
    process.exit(1);
  }

  if (error.response) {
    console.error(
      `Request failed (${error.response.status} ${error.response.statusText ?? ''})`
    );
    if (error.response.data) {
      console.error(
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data, null, 2)
      );
    }
  } else if (error.request) {
    console.error('Request was made but no response received (network issue).');
  } else {
    console.error(error.message);
  }

  if (process.env.DEBUG) {
    console.error(error);
  }

  process.exit(1);
}
