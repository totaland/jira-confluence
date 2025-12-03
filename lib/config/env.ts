import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { AppError } from '../error.js';

const JiraApiVersionSchema = z.enum(['2', '3', 'v2', 'v3', '']).default('');
const JiraAuthModeSchema = z.enum(['bearer', 'basic']).default('bearer');

export const EnvSchema = z.object({
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_HOST: z.string().url().optional(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().min(1).optional(),
  JIRA_PASSWORD: z.string().min(1).optional(),
  JIRA_API_VERSION: JiraApiVersionSchema,
  JIRA_AUTH_MODE: JiraAuthModeSchema,
  JIRA_BEARER_TOKEN: z.string().min(1).optional(),
  JIRA_ACCESS_TOKEN: z.string().min(1).optional(),
  JIRA_TOKEN: z.string().min(1).optional(),
  JIRA_DEFAULT_PROJECT: z.string().optional(),
  JIRA_ACCEPTANCE_FIELD: z.string().optional(),
  JIRA_ACCEPTANCE_FIELDS: z.string().optional(),
  JIRA_EPIC_FIELD: z.string().optional(),
  JIRA_EPIC_FIELDS: z.string().optional(),
  JIRA_EPIC_STRING_FIELDS: z.string().optional(),

  CONFLUENCE_BASE_URL: z.string().url().optional(),
  CONFLUENCE_HOST: z.string().url().optional(),
  CONFLUENCE_EMAIL: z.string().email().optional(),
  CONFLUENCE_API_TOKEN: z.string().min(1).optional(),
  CONFLUENCE_PASSWORD: z.string().min(1).optional(),
  CONFLUENCE_AUTH_MODE: z.enum(['bearer', 'basic']).default('basic'),
  CONFLUENCE_BEARER_TOKEN: z.string().min(1).optional(),
  CONFLUENCE_ACCESS_TOKEN: z.string().min(1).optional(),
  CONFLUENCE_TOKEN: z.string().min(1).optional(),

  DEBUG: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export interface ValidatedEnv {
  jira: {
    baseUrl: string | undefined;
    email: string | undefined;
    apiToken: string | undefined;
    apiVersion: string;
    authMode: 'bearer' | 'basic';
    bearerToken: string | undefined;
    defaultProject: string | undefined;
  };
  confluence: {
    baseUrl: string | undefined;
    email: string | undefined;
    apiToken: string | undefined;
    authMode: 'bearer' | 'basic';
    bearerToken: string | undefined;
  };
  debug: boolean;
}

export function loadEnvFile(envFileName = '.env'): void {
  const envFilePath = path.resolve(process.cwd(), envFileName);

  if (!fs.existsSync(envFilePath)) {
    return;
  }

  dotenv.config({ path: envFilePath });
}

export function loadEnv(envFileName = '.env'): void {
  loadEnvFile(envFileName);
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): ValidatedEnv {
  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw AppError.config(`Invalid environment configuration: ${issues}`);
  }

  const data = result.data;

  return {
    jira: {
      baseUrl: data.JIRA_BASE_URL ?? data.JIRA_HOST,
      email: data.JIRA_EMAIL,
      apiToken: data.JIRA_API_TOKEN ?? data.JIRA_PASSWORD,
      apiVersion: data.JIRA_API_VERSION,
      authMode: data.JIRA_AUTH_MODE,
      bearerToken: data.JIRA_BEARER_TOKEN ?? data.JIRA_ACCESS_TOKEN ?? data.JIRA_TOKEN,
      defaultProject: data.JIRA_DEFAULT_PROJECT,
    },
    confluence: {
      baseUrl: data.CONFLUENCE_BASE_URL ?? data.CONFLUENCE_HOST,
      email: data.CONFLUENCE_EMAIL,
      apiToken: data.CONFLUENCE_API_TOKEN ?? data.CONFLUENCE_PASSWORD,
      authMode: data.CONFLUENCE_AUTH_MODE,
      bearerToken:
        data.CONFLUENCE_BEARER_TOKEN ?? data.CONFLUENCE_ACCESS_TOKEN ?? data.CONFLUENCE_TOKEN,
    },
    debug: Boolean(data.DEBUG),
  };
}

export function getValidatedEnv(): ValidatedEnv {
  return validateEnv(process.env);
}
