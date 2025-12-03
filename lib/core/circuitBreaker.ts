import { AppError } from '../error.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
  shouldTrip?: (error: unknown) => boolean;
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState, service: string) => void;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30000;
const DEFAULT_HALF_OPEN_MAX_ATTEMPTS = 1;

interface CircuitState {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
}

const circuits = new Map<string, CircuitState>();

function getCircuit(serviceName: string): CircuitState {
  let circuit = circuits.get(serviceName);
  if (!circuit) {
    circuit = {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      halfOpenAttempts: 0,
    };
    circuits.set(serviceName, circuit);
  }
  return circuit;
}

function transitionTo(
  circuit: CircuitState,
  newState: CircuitBreakerState,
  serviceName: string,
  onStateChange?: CircuitBreakerOptions['onStateChange']
): void {
  if (circuit.state === newState) {
    return;
  }

  const oldState = circuit.state;
  circuit.state = newState;

  if (newState === 'closed') {
    circuit.failureCount = 0;
    circuit.halfOpenAttempts = 0;
  } else if (newState === 'half-open') {
    circuit.halfOpenAttempts = 0;
  }

  if (onStateChange) {
    onStateChange(oldState, newState, serviceName);
  }
}

export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const {
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    resetTimeoutMs = DEFAULT_RESET_TIMEOUT_MS,
    halfOpenMaxAttempts = DEFAULT_HALF_OPEN_MAX_ATTEMPTS,
    shouldTrip = () => true,
    onStateChange,
  } = options;

  const circuit = getCircuit(serviceName);
  const now = Date.now();

  if (circuit.state === 'open') {
    if (now - circuit.lastFailureTime >= resetTimeoutMs) {
      transitionTo(circuit, 'half-open', serviceName, onStateChange);
    } else {
      throw AppError.circuitBreakerOpen(serviceName);
    }
  }

  if (circuit.state === 'half-open' && circuit.halfOpenAttempts >= halfOpenMaxAttempts) {
    throw AppError.circuitBreakerOpen(serviceName);
  }

  if (circuit.state === 'half-open') {
    circuit.halfOpenAttempts++;
  }

  try {
    const result = await fn();

    if (circuit.state === 'half-open') {
      transitionTo(circuit, 'closed', serviceName, onStateChange);
    } else if (circuit.state === 'closed') {
      circuit.failureCount = 0;
    }

    return result;
  } catch (error) {
    if (!shouldTrip(error)) {
      throw error;
    }

    circuit.failureCount++;
    circuit.lastFailureTime = now;

    if (circuit.state === 'half-open') {
      transitionTo(circuit, 'open', serviceName, onStateChange);
    } else if (circuit.failureCount >= failureThreshold) {
      transitionTo(circuit, 'open', serviceName, onStateChange);
    }

    throw error;
  }
}

export function getCircuitState(serviceName: string): CircuitBreakerState {
  return getCircuit(serviceName).state;
}

export function resetCircuit(serviceName: string): void {
  circuits.delete(serviceName);
}

export function resetAllCircuits(): void {
  circuits.clear();
}

export function getCircuitStats(serviceName: string): {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
} {
  const circuit = getCircuit(serviceName);
  return {
    state: circuit.state,
    failureCount: circuit.failureCount,
    lastFailureTime: circuit.lastFailureTime,
  };
}
