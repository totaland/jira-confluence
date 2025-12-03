import fs from 'fs';
import path from 'path';
import { JiraConfigSchema, DEFAULT_JIRA_CONFIG, type JiraConfig } from './jira.js';
import { AppError } from '../error.js';

const CONFIG_FILE_NAME = 'jira.config.json';

export interface LoadJiraConfigOptions {
  configPath?: string;
  required?: boolean;
}

export function loadJiraConfig(options: LoadJiraConfigOptions = {}): JiraConfig {
  const configPath = options.configPath ?? path.resolve(process.cwd(), CONFIG_FILE_NAME);

  if (!fs.existsSync(configPath)) {
    if (options.required) {
      throw AppError.config(`Jira config file not found: ${configPath}`);
    }
    return { ...DEFAULT_JIRA_CONFIG };
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw AppError.config(`Failed to read Jira config file: ${configPath}`, error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw AppError.config(`Invalid JSON in Jira config file: ${configPath}`, error);
  }

  const result = JiraConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.config(`Invalid Jira config: ${issues}`);
  }

  return {
    ...DEFAULT_JIRA_CONFIG,
    ...result.data,
    fieldMapping: {
      ...DEFAULT_JIRA_CONFIG.fieldMapping,
      ...result.data.fieldMapping,
    },
  };
}

let cachedConfig: JiraConfig | null = null;

export function getJiraConfig(options: LoadJiraConfigOptions = {}): JiraConfig {
  if (!cachedConfig) {
    cachedConfig = loadJiraConfig(options);
  }
  return cachedConfig;
}

export function clearJiraConfigCache(): void {
  cachedConfig = null;
}
