import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  isNetworkError,
  isRetryableStatusCode,
  isRetryableError,
  createDefaultShouldRetry,
} from '../../lib/core/retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxAttempts: 3 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts exhausted', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, { maxAttempts: 3 });
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxAttempts option', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const promise = withRetry(fn, { maxAttempts: 5 });
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('should call onRetry callback on each retry', async () => {
    const error = new Error('retry error');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const promise = withRetry(fn, { maxAttempts: 3, onRetry });

    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
    expect(onRetry).toHaveBeenCalledWith(error, 2, expect.any(Number));
  });

  it('should stop retrying when shouldRetry returns false', async () => {
    const retryableError = new Error('retryable');
    const nonRetryableError = new Error('non-retryable');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(nonRetryableError);

    const shouldRetry = vi.fn((error: unknown) => {
      return error instanceof Error && error.message === 'retryable';
    });

    const promise = withRetry(fn, { maxAttempts: 5, shouldRetry });
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use exponential backoff with jitter', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const delays: number[] = [];
    const onRetry = vi.fn((_error, _attempt, delayMs) => {
      delays.push(delayMs);
    });

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      onRetry,
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(delays[0]).toBeGreaterThanOrEqual(1000);
    expect(delays[0]).toBeLessThanOrEqual(1300);

    expect(delays[1]).toBeGreaterThanOrEqual(2000);
    expect(delays[1]).toBeLessThanOrEqual(2600);
  });

  it('should respect maxDelayMs cap', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const delays: number[] = [];
    const onRetry = vi.fn((_error, _attempt, delayMs) => {
      delays.push(delayMs);
    });

    const promise = withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 10000,
      maxDelayMs: 15000,
      onRetry,
    });
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('fail');

    delays.forEach((delay) => {
      expect(delay).toBeLessThanOrEqual(15000);
    });
  });
});

describe('isNetworkError', () => {
  it('should return true for ECONNRESET error', () => {
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return true for ECONNREFUSED error', () => {
    const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return true for ETIMEDOUT error', () => {
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return true for socket hang up message', () => {
    const error = new Error('socket hang up');
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return true for network error message', () => {
    const error = new Error('Network Error');
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return false for regular error', () => {
    const error = new Error('Something went wrong');
    expect(isNetworkError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isNetworkError('string error')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('isRetryableStatusCode', () => {
  it('should return true for 429', () => {
    expect(isRetryableStatusCode(429)).toBe(true);
  });

  it('should return true for 502', () => {
    expect(isRetryableStatusCode(502)).toBe(true);
  });

  it('should return true for 503', () => {
    expect(isRetryableStatusCode(503)).toBe(true);
  });

  it('should return true for 504', () => {
    expect(isRetryableStatusCode(504)).toBe(true);
  });

  it('should return false for 400', () => {
    expect(isRetryableStatusCode(400)).toBe(false);
  });

  it('should return false for 401', () => {
    expect(isRetryableStatusCode(401)).toBe(false);
  });

  it('should return false for 404', () => {
    expect(isRetryableStatusCode(404)).toBe(false);
  });

  it('should return false for 500', () => {
    expect(isRetryableStatusCode(500)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isRetryableStatusCode(undefined)).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('should return true for network errors', () => {
    const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for HTTP error with retryable status', () => {
    const error = { message: 'Too Many Requests', response: { status: 429 } };
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for error with status property', () => {
    const error = { message: 'Service Unavailable', status: 503 };
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for non-retryable HTTP error', () => {
    const error = { message: 'Not Found', response: { status: 404 } };
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for regular error', () => {
    const error = new Error('validation failed');
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('createDefaultShouldRetry', () => {
  it('should return a function that checks if error is retryable', () => {
    const shouldRetry = createDefaultShouldRetry();

    const retryableError = { message: 'Rate limited', response: { status: 429 } };
    const nonRetryableError = new Error('Invalid input');

    expect(shouldRetry(retryableError, 1)).toBe(true);
    expect(shouldRetry(nonRetryableError, 1)).toBe(false);
  });
});
