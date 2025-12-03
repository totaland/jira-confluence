import type { ConfluenceClient } from '../client/ConfluenceClient.js';
import type { ConfluencePage, ConfluenceSearchResult } from '../client/types.js';

export interface PageServiceConfig {
  client: ConfluenceClient;
  baseUrl?: string;
}

export interface SearchPagesOptions {
  limit?: number;
  start?: number;
  expand?: string[];
}

export interface CreatePageInput {
  spaceKey: string;
  title: string;
  body: string;
  parentId?: string;
}

export interface UpdatePageInput {
  title?: string;
  body?: string;
}

export interface CleanPage {
  id: string;
  title: string;
  spaceKey?: string;
  spaceName?: string;
  version: number;
  body?: string;
  url?: string;
  ancestors?: Array<{ id: string; title?: string }>;
}

export class PageService {
  private readonly client: ConfluenceClient;
  private readonly baseUrl: string;

  constructor(config: PageServiceConfig) {
    this.client = config.client;
    this.baseUrl = config.baseUrl ?? process.env.CONFLUENCE_BASE_URL ?? '';
  }

  async readPage(pageId: string): Promise<ConfluencePage> {
    return this.client.getPageById(pageId);
  }

  async readPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null> {
    return this.client.getPageByTitle({ spaceKey, title });
  }

  async searchPages(cql: string, options: SearchPagesOptions = {}): Promise<ConfluenceSearchResult> {
    return this.client.search({
      cql,
      limit: options.limit,
      expand: options.expand,
    });
  }

  async searchByText(text: string, options: SearchPagesOptions = {}): Promise<ConfluenceSearchResult> {
    const escapedText = this.escapeCqlText(text);
    const cql = `text ~ "${escapedText}" ORDER BY lastmodified DESC`;
    return this.searchPages(cql, options);
  }

  async searchBySpace(spaceKey: string, options: SearchPagesOptions = {}): Promise<ConfluenceSearchResult> {
    const cql = `space = "${spaceKey}" AND type = page ORDER BY lastmodified DESC`;
    return this.searchPages(cql, options);
  }

  async createPage(input: CreatePageInput): Promise<ConfluencePage> {
    return this.client.createPage({
      spaceKey: input.spaceKey,
      title: input.title,
      body: input.body,
      parentId: input.parentId,
    });
  }

  async updatePage(pageId: string, input: UpdatePageInput): Promise<ConfluencePage> {
    const currentPage = await this.client.getPageById(pageId);
    return this.client.updatePage(pageId, currentPage, {
      title: input.title,
      body: input.body,
    });
  }

  buildCleanPage(page: ConfluencePage): CleanPage {
    const webUrl = page._links?.webui
      ? `${this.baseUrl}${page._links.webui}`
      : undefined;

    return {
      id: page.id,
      title: page.title,
      spaceKey: page.space?.key,
      spaceName: page.space?.name,
      version: page.version.number,
      body: page.body?.storage?.value,
      url: webUrl,
      ancestors: page.ancestors,
    };
  }

  private escapeCqlText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }
}
