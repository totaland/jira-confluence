import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, loadEnvFile } from '../../lib/config/env.js';
import { AppError } from '../../lib/error.js';
import fs from 'fs';
import path from 'path';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate valid environment variables', () => {
    const env = {
      JIRA_BASE_URL: 'https://mycompany.atlassian.net',
      JIRA_EMAIL: 'user@example.com',
      JIRA_API_TOKEN: 'secret-token',
      JIRA_API_VERSION: '3',
      JIRA_AUTH_MODE: 'basic',
      CONFLUENCE_BASE_URL: 'https://mycompany.atlassian.net/wiki',
      CONFLUENCE_EMAIL: 'user@example.com',
      CONFLUENCE_API_TOKEN: 'confluence-token',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.baseUrl).toBe('https://mycompany.atlassian.net');
    expect(result.jira.email).toBe('user@example.com');
    expect(result.jira.apiToken).toBe('secret-token');
    expect(result.jira.apiVersion).toBe('3');
    expect(result.jira.authMode).toBe('basic');
    expect(result.confluence.baseUrl).toBe('https://mycompany.atlassian.net/wiki');
  });

  it('should use defaults for optional values', () => {
    const env = {};

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.authMode).toBe('bearer');
    expect(result.jira.apiVersion).toBe('');
    expect(result.confluence.authMode).toBe('basic');
    expect(result.debug).toBe(false);
  });

  it('should prefer JIRA_BASE_URL over JIRA_HOST', () => {
    const env = {
      JIRA_BASE_URL: 'https://primary.atlassian.net',
      JIRA_HOST: 'https://fallback.atlassian.net',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.baseUrl).toBe('https://primary.atlassian.net');
  });

  it('should fallback to JIRA_HOST when JIRA_BASE_URL is not set', () => {
    const env = {
      JIRA_HOST: 'https://fallback.atlassian.net',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.baseUrl).toBe('https://fallback.atlassian.net');
  });

  it('should prefer JIRA_API_TOKEN over JIRA_PASSWORD', () => {
    const env = {
      JIRA_API_TOKEN: 'api-token',
      JIRA_PASSWORD: 'password',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.apiToken).toBe('api-token');
  });

  it('should resolve bearer token from multiple sources', () => {
    const env = {
      JIRA_BEARER_TOKEN: 'bearer-token',
      JIRA_ACCESS_TOKEN: 'access-token',
      JIRA_TOKEN: 'token',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.jira.bearerToken).toBe('bearer-token');
  });

  it('should throw AppError for invalid URL', () => {
    const env = {
      JIRA_BASE_URL: 'not-a-valid-url',
    };

    expect(() => validateEnv(env as unknown as NodeJS.ProcessEnv)).toThrow(AppError);
  });

  it('should throw AppError for invalid email', () => {
    const env = {
      JIRA_EMAIL: 'not-an-email',
    };

    expect(() => validateEnv(env as unknown as NodeJS.ProcessEnv)).toThrow(AppError);
  });

  it('should throw AppError for invalid auth mode', () => {
    const env = {
      JIRA_AUTH_MODE: 'invalid-mode',
    };

    expect(() => validateEnv(env as unknown as NodeJS.ProcessEnv)).toThrow(AppError);
  });

  it('should set debug to true when DEBUG is set', () => {
    const env = {
      DEBUG: '1',
    };

    const result = validateEnv(env as unknown as NodeJS.ProcessEnv);

    expect(result.debug).toBe(true);
  });
});

describe('loadEnvFile', () => {
  const testDir = path.join(process.cwd(), 'test-env-files');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should not throw when .env file does not exist', () => {
    expect(() => loadEnvFile('nonexistent.env')).not.toThrow();
  });
});
