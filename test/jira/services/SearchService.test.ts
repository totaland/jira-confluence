import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../../lib/jira/services/SearchService.js';
import type { JiraClient } from '../../../lib/jira/client/JiraClient.js';
import type { JiraSearchResult } from '../../../lib/jira/client/types.js';

function createMockClient(searchResult?: Partial<JiraSearchResult>) {
  const defaultResult: JiraSearchResult = {
    issues: [],
    total: 0,
    startAt: 0,
    maxResults: 50,
    ...searchResult,
  };

  return {
    search: vi.fn().mockResolvedValue(defaultResult),
    getIssue: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    listFields: vi.fn(),
    getUnderlyingClient: vi.fn(),
  } as unknown as JiraClient;
}

describe('SearchService', () => {
  let mockClient: JiraClient;
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient({
      issues: [
        { id: '10001', key: 'TEST-1', fields: { summary: 'Test issue 1' } },
        { id: '10002', key: 'TEST-2', fields: { summary: 'Test issue 2' } },
      ],
      total: 2,
      startAt: 0,
      maxResults: 50,
    });
    service = new SearchService({ client: mockClient });
  });

  describe('searchByJql', () => {
    it('searches with provided JQL', async () => {
      const result = await service.searchByJql('project = TEST');

      expect(mockClient.search).toHaveBeenCalledWith({
        jql: 'project = TEST',
        maxResults: 50,
        startAt: undefined,
        fields: expect.any(Array),
        expand: undefined,
      });
      expect(result.issues).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('respects limit option', async () => {
      await service.searchByJql('project = TEST', { limit: 10 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 10 })
      );
    });

    it('respects startAt option', async () => {
      await service.searchByJql('project = TEST', { startAt: 20 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ startAt: 20 })
      );
    });

    it('uses custom fields when provided', async () => {
      await service.searchByJql('project = TEST', { fields: ['summary', 'status'] });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['summary', 'status'] })
      );
    });

    it('uses expand when provided', async () => {
      await service.searchByJql('project = TEST', { expand: ['renderedFields'] });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ expand: ['renderedFields'] })
      );
    });

    it('normalizes result with default values', async () => {
      mockClient = createMockClient({
        issues: undefined,
        total: undefined,
        startAt: undefined,
        maxResults: undefined,
      });
      service = new SearchService({ client: mockClient });

      const result = await service.searchByJql('project = TEST');

      expect(result.issues).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.startAt).toBe(0);
      expect(result.maxResults).toBe(0);
    });
  });

  describe('searchByText', () => {
    it('builds text search JQL', async () => {
      await service.searchByText('login bug');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: 'text ~ "login bug" ORDER BY updated DESC',
        })
      );
    });

    it('escapes special characters in text', async () => {
      await service.searchByText('test "with quotes"');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: expect.stringContaining('\\"with quotes\\"'),
        })
      );
    });

    it('escapes backslashes', async () => {
      await service.searchByText('path\\to\\file');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: expect.stringContaining('path\\\\to\\\\file'),
        })
      );
    });
  });

  describe('searchByProject', () => {
    it('builds project search JQL', async () => {
      await service.searchByProject('MYPROJ');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: 'project = "MYPROJ" ORDER BY updated DESC',
        })
      );
    });

    it('passes options through', async () => {
      await service.searchByProject('MYPROJ', { limit: 25 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 25 })
      );
    });
  });

  describe('searchByAssignee', () => {
    it('builds assignee search JQL', async () => {
      await service.searchByAssignee('john.doe');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: 'assignee = "john.doe" ORDER BY updated DESC',
        })
      );
    });

    it('handles currentUser() special value', async () => {
      await service.searchByAssignee('currentUser()');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          jql: 'assignee = currentUser() ORDER BY updated DESC',
        })
      );
    });
  });

  describe('searchClean', () => {
    it('returns clean issues', async () => {
      mockClient = createMockClient({
        issues: [
          {
            id: '10001',
            key: 'TEST-1',
            fields: {
              summary: 'Test issue',
              issuetype: { name: 'Story' },
              status: { name: 'Open' },
            },
          },
        ],
        total: 1,
      });
      service = new SearchService({ client: mockClient, baseUrl: 'https://jira.example.com' });

      const result = await service.searchClean('project = TEST');

      expect(result.issues[0]).toMatchObject({
        key: 'TEST-1',
        summary: 'Test issue',
        issueType: 'Story',
        status: 'Open',
      });
    });
  });

  describe('configuration', () => {
    it('uses configured default limit', async () => {
      service = new SearchService({ client: mockClient, defaultLimit: 100 });

      await service.searchByJql('project = TEST');

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 100 })
      );
    });

    it('option limit overrides default', async () => {
      service = new SearchService({ client: mockClient, defaultLimit: 100 });

      await service.searchByJql('project = TEST', { limit: 25 });

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 25 })
      );
    });
  });
});
