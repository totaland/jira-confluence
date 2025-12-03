import { promises as fs } from 'fs';
import path from 'path';
import * as confluenceModule from 'confluence.js';

export interface ConfluenceContentBodyStorage {
  value: string;
  representation: 'storage';
}

export interface ConfluenceContent {
  id: string;
  type: string;
  title: string;
  version: { number: number };
  body: {
    storage?: ConfluenceContentBodyStorage;
    [key: string]: unknown;
  };
}

interface ConfluenceContentApi {
  getContentById(params: {
    id: string;
    expand?: string[];
  }): Promise<ConfluenceContent>;
  getContent(params: {
    spaceKey: string;
    title: string;
    expand?: string[];
    limit?: number;
  }): Promise<{ results: ConfluenceContent[] }>;
  updateContent(payload: unknown): Promise<ConfluenceContent>;
  createContent(payload: unknown): Promise<ConfluenceContent>;
  searchContentByCQL(params: {
    cql: string;
    limit?: number;
    expand?: string[];
  }): Promise<{ results: ConfluenceContent[] }>;
}

export interface ConfluenceClient {
  content: ConfluenceContentApi;
}

type ConfluenceClientConstructor = new (config: Record<string, unknown>) => ConfluenceClient;

const ConfluenceClientCtor: ConfluenceClientConstructor = (() => {
  const mod = confluenceModule as Record<string, unknown>;
  return (mod.ConfluenceClient ?? mod.Client ?? mod.default ?? mod) as ConfluenceClientConstructor;
})();

export function createConfluenceClient(): ConfluenceClient {
  if (typeof ConfluenceClientCtor !== 'function') {
    throw new Error('Unable to resolve Confluence client constructor from confluence.js');
  }

  const host = process.env.CONFLUENCE_BASE_URL ?? process.env.CONFLUENCE_HOST;

  if (!host) {
    throw new Error('Missing CONFLUENCE_BASE_URL environment variable (or legacy CONFLUENCE_HOST).');
  }

  const authMode = (process.env.CONFLUENCE_AUTH_MODE ?? 'bearer').toLowerCase();
  const config: Record<string, unknown> = {
    host,
    apiPrefix: '/rest',
  };

  if (authMode === 'bearer') {
    const accessToken =
      process.env.CONFLUENCE_BEARER_TOKEN ??
      process.env.CONFLUENCE_ACCESS_TOKEN ??
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

    return new ConfluenceClientCtor(config);
  }

  if (authMode === 'basic') {
    const username = process.env.CONFLUENCE_EMAIL ?? process.env.CONFLUENCE_USERNAME;
    const password =
      process.env.CONFLUENCE_API_TOKEN ??
      process.env.CONFLUENCE_PASSWORD ??
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

    return new ConfluenceClientCtor(config);
  }

  throw new Error(
    `Unsupported CONFLUENCE_AUTH_MODE "${process.env.CONFLUENCE_AUTH_MODE}". Use "bearer" or "basic".`
  );
}

export interface ConfluenceReadOptions {
  id?: string;
  space?: string;
  title?: string;
}

export interface ConfluenceUpdateOptions {
  id: string;
  title?: string;
  body?: string;
  bodyFile?: string;
}

export interface ConfluenceCreateOptions {
  space: string;
  title: string;
  body?: string;
  bodyFile?: string;
  parent?: string;
}

export interface ConfluenceSearchOptions {
  cql?: string;
  text?: string;
  space?: string;
  limit?: number;
  read?: boolean;
}

async function readBodyOption(options: {
  body?: string;
  bodyFile?: string;
}): Promise<string | null> {
  if (options.body && options.bodyFile) {
    throw new Error('Use either --body or --body-file, not both');
  }

  if (options.body) {
    return options.body;
  }

  if (options.bodyFile) {
    const filePath = path.resolve(process.cwd(), options.bodyFile);
    return fs.readFile(filePath, 'utf8');
  }

  return null;
}

export async function fetchConfluencePage(
  client: ConfluenceClient,
  opts: ConfluenceReadOptions
): Promise<ConfluenceContent> {
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

export async function handleConfluenceRead(opts: ConfluenceReadOptions): Promise<void> {
  const client = createConfluenceClient();
  const page = await fetchConfluencePage(client, opts);
  console.log(JSON.stringify(page, null, 2));
}

export async function handleConfluenceUpdate(opts: ConfluenceUpdateOptions): Promise<void> {
  if (!opts.id) {
    throw new Error('Updating Confluence content requires --id');
  }

  const client = createConfluenceClient();
  const page = await fetchConfluencePage(client, { id: opts.id });
  const body = await readBodyOption(opts);

  const payload: {
    id: string;
    type: string;
    title: string;
    version: { number: number };
    body: unknown;
  } = {
    id: page.id,
    type: page.type,
    title: opts.title ?? page.title,
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

export async function handleConfluenceCreate(opts: ConfluenceCreateOptions): Promise<void> {
  const body = await readBodyOption(opts);

  if (!body) {
    throw new Error('Creating a Confluence page requires --body or --body-file');
  }

  const client = createConfluenceClient();
  const payload: {
    type: string;
    title: string;
    space: { key: string };
    body: {
      storage: {
        value: string;
        representation: 'storage';
      };
    };
    ancestors?: Array<{ id: string }>;
  } = {
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

export async function handleConfluenceSearch(opts: ConfluenceSearchOptions): Promise<void> {
  if (!opts.cql && !opts.text) {
    throw new Error('Provide either --cql or --text for search');
  }

  const client = createConfluenceClient();

  let cql = opts.cql;
  if (!cql && opts.text) {
    const escaped = opts.text.replace(/"/g, '\\"');
    cql = opts.space
      ? `space = "${opts.space}" AND text ~ "${escaped}"`
      : `text ~ "${escaped}"`;
  }

  const response = await client.content.searchContentByCQL({
    cql: cql!,
    limit: opts.limit ?? 10,
    expand: ['version'],
  });

  if (!response.results?.length) {
    console.log('No pages found.');
    return;
  }

  // If --read flag is set, fetch and display the first result
  if (opts.read) {
    const firstPage = response.results[0];
    const fullPage = await fetchConfluencePage(client, { id: firstPage.id });
    console.log(JSON.stringify(fullPage, null, 2));
    return;
  }

  response.results.forEach((page) => {
    console.log(`${page.id}: ${page.title}`);
  });
}
