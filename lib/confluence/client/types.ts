import { z } from 'zod';

export const ConfluenceBodyStorageSchema = z.object({
  value: z.string(),
  representation: z.literal('storage'),
});

export type ConfluenceBodyStorage = z.infer<typeof ConfluenceBodyStorageSchema>;

export const ConfluenceVersionSchema = z.object({
  number: z.number(),
  when: z.string().optional(),
  message: z.string().optional(),
});

export type ConfluenceVersion = z.infer<typeof ConfluenceVersionSchema>;

export const ConfluenceSpaceSchema = z.object({
  id: z.number().optional(),
  key: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
});

export type ConfluenceSpace = z.infer<typeof ConfluenceSpaceSchema>;

export const ConfluencePageSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  status: z.string().optional(),
  version: ConfluenceVersionSchema,
  space: ConfluenceSpaceSchema.optional(),
  body: z.object({
    storage: ConfluenceBodyStorageSchema.optional(),
  }).passthrough().optional(),
  ancestors: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
  })).optional(),
  _links: z.object({
    webui: z.string().optional(),
    self: z.string().optional(),
  }).optional(),
}).passthrough();

export type ConfluencePage = z.infer<typeof ConfluencePageSchema>;

export const ConfluenceSearchResultSchema = z.object({
  results: z.array(ConfluencePageSchema),
  start: z.number().optional(),
  limit: z.number().optional(),
  size: z.number().optional(),
  _links: z.object({
    next: z.string().optional(),
    self: z.string().optional(),
  }).optional(),
});

export type ConfluenceSearchResult = z.infer<typeof ConfluenceSearchResultSchema>;

export interface GetPageParams {
  expand?: string[];
}

export interface SearchParams {
  cql: string;
  limit?: number;
  start?: number;
  expand?: string[];
}

export interface CreatePageParams {
  spaceKey: string;
  title: string;
  body: string;
  parentId?: string;
}

export interface UpdatePageParams {
  title?: string;
  body?: string;
  version?: number;
}

export interface GetContentParams {
  spaceKey: string;
  title: string;
  limit?: number;
  expand?: string[];
}
