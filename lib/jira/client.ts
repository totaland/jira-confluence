import { Version2Client, Version3Client } from 'jira.js';

export type JiraApiVersion = '2' | '3';
export type JiraClient = Version2Client | Version3Client;

export function resolveJiraApiVersion(host: string): JiraApiVersion {
  const versionOverride = (process.env.JIRA_API_VERSION ?? '').trim().toLowerCase();

  if (versionOverride === '3' || versionOverride === 'v3') {
    return '3';
  }

  if (versionOverride === '2' || versionOverride === 'v2') {
    return '2';
  }

  try {
    const hostname = new URL(host).hostname.toLowerCase();
    if (hostname.endsWith('.atlassian.net')) {
      return '3';
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('Failed to parse Jira host URL:', error);
    }
  }

  return '2';
}

export function createJiraClient(): JiraClient {
  const host = process.env.JIRA_BASE_URL ?? process.env.JIRA_HOST;

  if (!host) {
    throw new Error('Missing JIRA_BASE_URL environment variable (or legacy JIRA_HOST).');
  }

  const apiVersion = resolveJiraApiVersion(host);
  const authMode = (process.env.JIRA_AUTH_MODE ?? 'bearer').toLowerCase();

  if (authMode === 'bearer') {
    const accessToken =
      process.env.JIRA_BEARER_TOKEN ??
      process.env.JIRA_ACCESS_TOKEN ??
      process.env.JIRA_TOKEN;

    if (!accessToken) {
      throw new Error(
        'Missing Jira bearer token. Set JIRA_BEARER_TOKEN (or JIRA_ACCESS_TOKEN / JIRA_TOKEN).'
      );
    }

    const clientConfig = {
      host,
      authentication: {
        oauth2: {
          accessToken,
        },
      },
    };

    return apiVersion === '3'
      ? new Version3Client(clientConfig)
      : new Version2Client(clientConfig);
  }

  if (authMode === 'basic') {
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN ?? process.env.JIRA_PASSWORD;

    if (!email || !apiToken) {
      throw new Error(
        'Basic auth requires JIRA_EMAIL and JIRA_API_TOKEN (or JIRA_PASSWORD) environment variables.'
      );
    }

    const clientConfig = {
      host,
      authentication: {
        basic: {
          email,
          apiToken,
        },
      },
    };

    return apiVersion === '3'
      ? new Version3Client(clientConfig)
      : new Version2Client(clientConfig);
  }

  throw new Error(`Unsupported JIRA_AUTH_MODE "${process.env.JIRA_AUTH_MODE}". Use "bearer" or "basic".`);
}
