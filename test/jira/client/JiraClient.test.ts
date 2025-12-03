import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRetryableJiraError,
  normalizeJiraError,
  isJiraErrorResponse,
  getJiraErrorStatus,
} from '../../../lib/jira/client/JiraClient.js';
import { AppError, ErrorCode } from '../../../lib/error.js';

describe('isJiraErrorResponse', () => {
  it('should return true for object with message', () => {
    expect(isJiraErrorResponse({ message: 'error' })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isJiraErrorResponse(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isJiraErrorResponse(undefined)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isJiraErrorResponse('error')).toBe(false);
  });

  it('should return false for object without message', () => {
    expect(isJiraErrorResponse({ error: 'something' })).toBe(false);
  });
});

describe('getJiraErrorStatus', () => {
  it('should return status from response.status', () => {
    const error = { message: 'error', response: { status: 404 } };
    expect(getJiraErrorStatus(error)).toBe(404);
  });

  it('should return status from top-level status', () => {
    const error = { message: 'error', status: 500 };
    expect(getJiraErrorStatus(error)).toBe(500);
  });

  it('should prefer response.status over top-level status', () => {
    const error = { message: 'error', response: { status: 404 }, status: 500 };
    expect(getJiraErrorStatus(error)).toBe(404);
  });

  it('should return undefined for non-error objects', () => {
    expect(getJiraErrorStatus('error')).toBeUndefined();
    expect(getJiraErrorStatus(null)).toBeUndefined();
    expect(getJiraErrorStatus(undefined)).toBeUndefined();
  });
});

describe('isRetryableJiraError', () => {
  it('should return true for 429 Too Many Requests', () => {
    const error = { message: 'Rate limited', response: { status: 429 } };
    expect(isRetryableJiraError(error)).toBe(true);
  });

  it('should return true for 503 Service Unavailable', () => {
    const error = { message: 'Service unavailable', response: { status: 503 } };
    expect(isRetryableJiraError(error)).toBe(true);
  });

  it('should return true for 502 Bad Gateway', () => {
    const error = { message: 'Bad gateway', response: { status: 502 } };
    expect(isRetryableJiraError(error)).toBe(true);
  });

  it('should return true for 504 Gateway Timeout', () => {
    const error = { message: 'Gateway timeout', response: { status: 504 } };
    expect(isRetryableJiraError(error)).toBe(true);
  });

  it('should return true for network errors', () => {
    const error = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
    expect(isRetryableJiraError(error)).toBe(true);
  });

  it('should return false for 400 Bad Request', () => {
    const error = { message: 'Bad request', response: { status: 400 } };
    expect(isRetryableJiraError(error)).toBe(false);
  });

  it('should return false for 401 Unauthorized', () => {
    const error = { message: 'Unauthorized', response: { status: 401 } };
    expect(isRetryableJiraError(error)).toBe(false);
  });

  it('should return false for 404 Not Found', () => {
    const error = { message: 'Not found', response: { status: 404 } };
    expect(isRetryableJiraError(error)).toBe(false);
  });
});

describe('normalizeJiraError', () => {
  it('should return same error if already AppError', () => {
    const appError = AppError.jiraApi('Already normalized', 400);
    const result = normalizeJiraError(appError);
    expect(result).toBe(appError);
  });

  it('should extract error messages from response data', () => {
    const error = {
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          errorMessages: ['Invalid project key', 'Summary is required'],
        },
      },
    };

    const result = normalizeJiraError(error);

    expect(result.code).toBe(ErrorCode.JIRA_API_ERROR);
    expect(result.message).toContain('Invalid project key');
    expect(result.message).toContain('Summary is required');
    expect(result.statusCode).toBe(400);
  });

  it('should extract field-specific errors from response data', () => {
    const error = {
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          errors: {
            summary: 'Summary is too long',
            priority: 'Invalid priority',
          },
        },
      },
    };

    const result = normalizeJiraError(error);

    expect(result.message).toContain('summary: Summary is too long');
    expect(result.message).toContain('priority: Invalid priority');
  });

  it('should combine error messages and field errors', () => {
    const error = {
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          errorMessages: ['General error'],
          errors: {
            summary: 'Field error',
          },
        },
      },
    };

    const result = normalizeJiraError(error);

    expect(result.message).toContain('General error');
    expect(result.message).toContain('summary: Field error');
  });

  it('should fall back to error.message if no detailed errors', () => {
    const error = {
      message: 'Connection timeout',
      response: {
        status: 504,
      },
    };

    const result = normalizeJiraError(error);

    expect(result.message).toBe('Connection timeout');
    expect(result.statusCode).toBe(504);
  });

  it('should handle unknown error types', () => {
    const result = normalizeJiraError('string error');

    expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(result.message).toBe('Unknown Jira error');
  });

  it('should preserve original error as cause', () => {
    const originalError = {
      message: 'Original error',
      response: { status: 500 },
    };

    const result = normalizeJiraError(originalError);

    expect(result.cause).toBe(originalError);
  });
});
