import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadJiraConfig, clearJiraConfigCache } from '../../lib/config/loadJiraConfig.js';
import { DEFAULT_JIRA_CONFIG } from '../../lib/config/jira.js';
import { AppError } from '../../lib/error.js';

describe('loadJiraConfig', () => {
  const testDir = path.join(process.cwd(), 'test-config-files');
  const testConfigPath = path.join(testDir, 'jira.config.json');

  beforeEach(() => {
    clearJiraConfigCache();
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    clearJiraConfigCache();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should return default config when file does not exist', () => {
    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result).toEqual(DEFAULT_JIRA_CONFIG);
  });

  it('should throw when required and file does not exist', () => {
    expect(() =>
      loadJiraConfig({ configPath: testConfigPath, required: true })
    ).toThrow(AppError);
  });

  it('should load valid config file', () => {
    const config = {
      apiVersion: '3',
      defaultProject: 'TEST',
      fieldMapping: {
        acceptance: 'customfield_10001',
        epic: 'customfield_10002',
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result.apiVersion).toBe('3');
    expect(result.defaultProject).toBe('TEST');
    expect(result.fieldMapping?.acceptance).toBe('customfield_10001');
    expect(result.fieldMapping?.epic).toBe('customfield_10002');
  });

  it('should merge with defaults', () => {
    const config = {
      defaultProject: 'PARTIAL',
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result.defaultProject).toBe('PARTIAL');
    expect(result.apiVersion).toBe(DEFAULT_JIRA_CONFIG.apiVersion);
    expect(result.fieldMapping).toEqual(DEFAULT_JIRA_CONFIG.fieldMapping);
  });

  it('should throw for invalid JSON', () => {
    fs.writeFileSync(testConfigPath, 'not valid json {{{');

    expect(() => loadJiraConfig({ configPath: testConfigPath })).toThrow(AppError);
  });

  it('should throw for invalid config schema', () => {
    const invalidConfig = {
      apiVersion: 'invalid-version',
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

    expect(() => loadJiraConfig({ configPath: testConfigPath })).toThrow(AppError);
  });

  it('should load epicStringFields array', () => {
    const config = {
      epicStringFields: ['customfield_10002', 'customfield_10003'],
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result.epicStringFields).toEqual(['customfield_10002', 'customfield_10003']);
  });

  it('should load acceptanceFieldCandidates array', () => {
    const config = {
      acceptanceFieldCandidates: ['customfield_10001', 'customfield_10100'],
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result.acceptanceFieldCandidates).toEqual([
      'customfield_10001',
      'customfield_10100',
    ]);
  });

  it('should load epicFieldCandidates array', () => {
    const config = {
      epicFieldCandidates: ['customfield_10002', 'customfield_10200'],
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = loadJiraConfig({ configPath: testConfigPath });

    expect(result.epicFieldCandidates).toEqual([
      'customfield_10002',
      'customfield_10200',
    ]);
  });
});
