const { URL } = require('url');

function resolveJiraApiVersion(host) {
  const versionOverride = (process.env.JIRA_API_VERSION || '').trim().toLowerCase();
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

function createJiraClient() {
  const { Version2Client, Version3Client } = require('jira.js');

  const host = process.env.JIRA_BASE_URL || process.env.JIRA_HOST;
  if (!host) {
    throw new Error('Missing JIRA_BASE_URL environment variable (or legacy JIRA_HOST).');
  }

  const apiVersion = resolveJiraApiVersion(host);
  const authMode = (process.env.JIRA_AUTH_MODE || '').toLowerCase() || 'bearer';
  const clientConfig = { host };

  if (authMode === 'bearer') {
    const accessToken =
      process.env.JIRA_BEARER_TOKEN ||
      process.env.JIRA_ACCESS_TOKEN ||
      process.env.JIRA_TOKEN;

    if (!accessToken) {
      throw new Error(
        'Missing Jira bearer token. Set JIRA_BEARER_TOKEN (or JIRA_ACCESS_TOKEN / JIRA_TOKEN).'
      );
    }

    clientConfig.authentication = {
      oauth2: {
        accessToken,
      },
    };
  } else if (authMode === 'basic') {
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN || process.env.JIRA_PASSWORD;

    if (!email || !apiToken) {
      throw new Error(
        'Basic auth requires JIRA_EMAIL and JIRA_API_TOKEN (or JIRA_PASSWORD) environment variables.'
      );
    }

    clientConfig.authentication = {
      basic: {
        email,
        apiToken,
      },
    };
  } else {
    throw new Error(`Unsupported JIRA_AUTH_MODE "${process.env.JIRA_AUTH_MODE}". Use "bearer" or "basic".`);
  }

  if (apiVersion === '3') {
    return new Version3Client(clientConfig);
  }

  if (apiVersion === '2') {
    return new Version2Client(clientConfig);
  }

  throw new Error(
    `Unsupported JIRA_API_VERSION "${process.env.JIRA_API_VERSION}". Use "2" or "3".`
  );
}

module.exports = {
  createJiraClient,
  resolveJiraApiVersion,
};
