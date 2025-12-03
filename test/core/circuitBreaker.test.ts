import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withCircuitBreaker,
  getCircuitState,
  resetCircuit,
  resetAllCircuits,
  getCircuitStats,
} from '../../lib/core/circuitBreaker.js';
import { AppError, ErrorCode } from '../../lib/error.js';

describe('withCircuitBreaker', () => {
  const SERVICE_NAME = 'test-service';

  beforeEach(() => {
    resetAllCircuits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute function when circuit is closed', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withCircuitBreaker(SERVICE_NAME, fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getCircuitState(SERVICE_NAME)).toBe('closed');
  });

  it('should open circuit after failure threshold is reached', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow('fail');
    }

    expect(getCircuitState(SERVICE_NAME)).toBe('open');
  });

  it('should throw CircuitBreakerOpen when circuit is open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow();
    }

    const blockedFn = vi.fn().mockResolvedValue('should not run');

    await expect(withCircuitBreaker(SERVICE_NAME, blockedFn)).rejects.toThrow(AppError);

    try {
      await withCircuitBreaker(SERVICE_NAME, blockedFn);
    } catch (error) {
      expect(AppError.isAppError(error)).toBe(true);
      expect((error as AppError).code).toBe(ErrorCode.CIRCUIT_BREAKER_OPEN);
    }

    expect(blockedFn).not.toHaveBeenCalled();
  });

  it('should transition to half-open after reset timeout', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow();
    }

    expect(getCircuitState(SERVICE_NAME)).toBe('open');

    vi.advanceTimersByTime(30000);

    const successFn = vi.fn().mockResolvedValue('recovered');
    const result = await withCircuitBreaker(SERVICE_NAME, successFn);

    expect(result).toBe('recovered');
    expect(getCircuitState(SERVICE_NAME)).toBe('closed');
  });

  it('should return to open state if half-open request fails', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, failFn)).rejects.toThrow();
    }

    vi.advanceTimersByTime(30000);

    await expect(withCircuitBreaker(SERVICE_NAME, failFn)).rejects.toThrow();

    expect(getCircuitState(SERVICE_NAME)).toBe('open');
  });

  it('should close circuit on successful half-open request', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, failFn)).rejects.toThrow();
    }

    vi.advanceTimersByTime(30000);

    const successFn = vi.fn().mockResolvedValue('success');
    await withCircuitBreaker(SERVICE_NAME, successFn);

    expect(getCircuitState(SERVICE_NAME)).toBe('closed');

    const stats = getCircuitStats(SERVICE_NAME);
    expect(stats.failureCount).toBe(0);
  });

  it('should respect custom failure threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(
        withCircuitBreaker(SERVICE_NAME, fn, { failureThreshold: 3 })
      ).rejects.toThrow();
    }

    expect(getCircuitState(SERVICE_NAME)).toBe('open');
  });

  it('should respect custom reset timeout', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(
        withCircuitBreaker(SERVICE_NAME, fn, { resetTimeoutMs: 60000 })
      ).rejects.toThrow();
    }

    vi.advanceTimersByTime(30000);

    await expect(withCircuitBreaker(SERVICE_NAME, fn, { resetTimeoutMs: 60000 })).rejects.toThrow(
      AppError
    );

    vi.advanceTimersByTime(30000);

    const successFn = vi.fn().mockResolvedValue('success');
    await withCircuitBreaker(SERVICE_NAME, successFn, { resetTimeoutMs: 60000 });

    expect(getCircuitState(SERVICE_NAME)).toBe('closed');
  });

  it('should call onStateChange when state transitions', async () => {
    const onStateChange = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(
        withCircuitBreaker(SERVICE_NAME, fn, { onStateChange })
      ).rejects.toThrow();
    }

    expect(onStateChange).toHaveBeenCalledWith('closed', 'open', SERVICE_NAME);

    vi.advanceTimersByTime(30000);

    const successFn = vi.fn().mockResolvedValue('success');
    await withCircuitBreaker(SERVICE_NAME, successFn, { onStateChange });

    expect(onStateChange).toHaveBeenCalledWith('open', 'half-open', SERVICE_NAME);
    expect(onStateChange).toHaveBeenCalledWith('half-open', 'closed', SERVICE_NAME);
  });

  it('should not trip circuit when shouldTrip returns false', async () => {
    const businessError = new Error('Business logic error');
    const fn = vi.fn().mockRejectedValue(businessError);

    const shouldTrip = vi.fn().mockReturnValue(false);

    for (let i = 0; i < 10; i++) {
      await expect(
        withCircuitBreaker(SERVICE_NAME, fn, { shouldTrip })
      ).rejects.toThrow();
    }

    expect(getCircuitState(SERVICE_NAME)).toBe('closed');
    expect(shouldTrip).toHaveBeenCalledWith(businessError);
  });

  it('should reset failure count on successful request', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));
    const successFn = vi.fn().mockResolvedValue('success');

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, failFn)).rejects.toThrow();
    }

    await withCircuitBreaker(SERVICE_NAME, successFn);

    const stats = getCircuitStats(SERVICE_NAME);
    expect(stats.failureCount).toBe(0);
  });
});

describe('resetCircuit', () => {
  const SERVICE_NAME = 'reset-test';

  beforeEach(() => {
    resetAllCircuits();
  });

  it('should reset circuit state to closed', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow();
    }

    expect(getCircuitState(SERVICE_NAME)).toBe('open');

    resetCircuit(SERVICE_NAME);

    expect(getCircuitState(SERVICE_NAME)).toBe('closed');
  });
});

describe('getCircuitStats', () => {
  const SERVICE_NAME = 'stats-test';

  beforeEach(() => {
    resetAllCircuits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial stats for new circuit', () => {
    const stats = getCircuitStats(SERVICE_NAME);

    expect(stats.state).toBe('closed');
    expect(stats.failureCount).toBe(0);
    expect(stats.lastFailureTime).toBe(0);
  });

  it('should track failure count', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow();
    }

    const stats = getCircuitStats(SERVICE_NAME);
    expect(stats.failureCount).toBe(3);
  });

  it('should track last failure time', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    await expect(withCircuitBreaker(SERVICE_NAME, fn)).rejects.toThrow();

    const stats = getCircuitStats(SERVICE_NAME);
    expect(stats.lastFailureTime).toBe(Date.now());
  });
});

describe('multiple services', () => {
  beforeEach(() => {
    resetAllCircuits();
  });

  it('should maintain separate state for different services', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));
    const successFn = vi.fn().mockResolvedValue('success');

    for (let i = 0; i < 5; i++) {
      await expect(withCircuitBreaker('service-a', failFn)).rejects.toThrow();
    }

    expect(getCircuitState('service-a')).toBe('open');
    expect(getCircuitState('service-b')).toBe('closed');

    await expect(withCircuitBreaker('service-b', successFn)).resolves.toBe('success');
  });
});
