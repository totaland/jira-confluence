import fs from 'fs';
import path from 'path';
import * as confluenceModule from 'confluence.js';

const ConfluenceClient =
  confluenceModule.ConfluenceClient ||
  confluenceModule.Client ||
  confluenceModule.default ||
  confluenceModule;

export function createConfluenceClient() {
  if (typeof ConfluenceClient !== 'function') {
    throw new Error('Unable to resolve Confluence client constructor from confluence.js');
  }

  const host = process.env.CONFLUENCE_BASE_URL || process.env.CONFLUENCE_HOST;
  if (!host) {
    throw new Error('Missing CONFLUENCE_BASE_URL environment variable (or legacy CONFLUENCE_HOST).');
  }

  const authMode = (process.env.CONFLUENCE_AUTH_MODE || '').toLowerCase() || 'bearer';
  const config = { host };

  if (authMode === 'bearer') {
    const accessToken =
      process.env.CONFLUENCE_BEARER_TOKEN ||
      process.env.CONFLUENCE_ACCESS_TOKEN ||
      process.env.CONFLUENCE_TOKEN;

    if (!accessToken) {
      throw new Error(
        'Missing Confluence bearer token. Set CONFLUENCE_BEARER_TOKEN (or CONFLUENCE_ACCESS_TOKEN / CONFLUENCE_TOKEN).'
      );
    }

    config.authentication = {
      oauth2: {
        accessToken,
      },
    };
    config.personalAccessToken = accessToken;
    config.accessToken = accessToken;
    config.token = accessToken;
  } else if (authMode === 'basic') {
    const username = process.env.CONFLUENCE_EMAIL || process.env.CONFLUENCE_USERNAME;
    const password =
      process.env.CONFLUENCE_API_TOKEN ||
      process.env.CONFLUENCE_PASSWORD ||
      process.env.CONFLUENCE_TOKEN;

    if (!username || !password) {
      throw new Error(
        'Basic auth for Confluence requires CONFLUENCE_EMAIL (or CONFLUENCE_USERNAME) and CONFLUENCE_API_TOKEN (or CONFLUENCE_PASSWORD / CONFLUENCE_TOKEN).'
      );
    }

    config.authentication = {
      basic: {
        email: username,
        apiToken: password,
      },
    };
    config.username = username;
    config.password = password;
  } else {
    throw new Error(
      `Unsupported CONFLUENCE_AUTH_MODE "${process.env.CONFLUENCE_AUTH_MODE}". Use "bearer" or "basic".`
    );
  }

  return new ConfluenceClient(config);
}

function readBodyOption(options) {
  if (options.body && options.bodyFile) {
    throw new Error('Use either --body or --body-file, not both');
  }

  if (options.body) {
    return options.body;
  }

  if (options.bodyFile) {
    const filePath = path.resolve(process.cwd(), options.bodyFile);
    return fs.readFileSync(filePath, 'utf8');
  }

  return null;
}

export async function fetchConfluencePage(client, opts) {
  if (opts.id) {
    return client.content.getContentById({
      id: opts.id,
      expand: ['body.storage', 'version'],
    });
  }

  if (opts.space && opts.title) {
    const result = await client.content.getContent({
      spaceKey: opts.space,
      title: opts.title,
      expand: ['body.storage', 'version'],
      limit: 1,
    });

    if (!result.results.length) {
      throw new Error(`No page found for space ${opts.space} with title "${opts.title}"`);
    }

    return result.results[0];
  }

  throw new Error('Provide either --id or combination of --space and --title');
}

export async function handleConfluenceRead(opts) {
  const client = createConfluenceClient();
  const page = await fetchConfluencePage(client, opts);
  console.log(JSON.stringify(page, null, 2));
}

export async function handleConfluenceUpdate(opts) {
  if (!opts.id) {
    throw new Error('Updating Confluence content requires --id');
  }

  const client = createConfluenceClient();
  const page = await fetchConfluencePage(client, { id: opts.id });
  const body = readBodyOption(opts);

  const payload = {
    id: page.id,
    type: page.type,
    title: opts.title || page.title,
    version: {
      number: page.version.number + 1,
    },
    body: page.body,
  };

  if (body) {
    payload.body = {
      storage: {
        value: body,
        representation: 'storage',
      },
    };
  }

  await client.content.updateContent(payload);
  console.log(`Updated Confluence page ${payload.id}`);
}

export async function handleConfluenceCreate(opts) {
  const body = readBodyOption(opts);
  if (!body) {
    throw new Error('Creating a Confluence page requires --body or --body-file');
  }

  const client = createConfluenceClient();
  const payload = {
    type: 'page',
    title: opts.title,
    space: { key: opts.space },
    body: {
      storage: {
        value: body,
        representation: 'storage',
      },
    },
  };

  if (opts.parent) {
    payload.ancestors = [{ id: opts.parent }];
  }

  const created = await client.content.createContent(payload);
  console.log(`Created Confluence page ${created.id}`);
}
