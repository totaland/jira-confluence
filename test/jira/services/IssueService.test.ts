import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IssueService, type CreateIssueInput, type UpdateIssueInput } from '../../../lib/jira/services/IssueService.js';
import { FieldService } from '../../../lib/jira/services/FieldService.js';
import type { JiraClient } from '../../../lib/jira/client/JiraClient.js';

function createMockClient() {
  return {
    createIssue: vi.fn().mockResolvedValue({ id: '10001', key: 'TEST-1' }),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    getIssue: vi.fn().mockResolvedValue({ id: '10001', key: 'TEST-1', fields: {} }),
    listFields: vi.fn().mockResolvedValue([]),
    search: vi.fn(),
    getUnderlyingClient: vi.fn(),
  } as unknown as JiraClient;
}

function createMockFieldService(fieldMap: Record<string, string> = {}) {
  return {
    resolveFieldId: vi.fn().mockImplementation((name: string) => Promise.resolve(fieldMap[name])),
    assertFieldId: vi.fn().mockImplementation((name: string) => {
      if (fieldMap[name]) return Promise.resolve(fieldMap[name]);
      return Promise.reject(new Error(`Field not found: ${name}`));
    }),
    clearCache: vi.fn(),
  } as unknown as FieldService;
}

describe('IssueService', () => {
  let mockClient: JiraClient;
  let mockFieldService: FieldService;
  let service: IssueService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    mockFieldService = createMockFieldService({
      acceptance: 'customfield_10001',
      epic: 'customfield_10002',
      storyPoints: 'customfield_10003',
    });
    service = new IssueService({
      client: mockClient,
      fieldService: mockFieldService,
    });
  });

  describe('createIssue', () => {
    it('creates issue with required fields', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
      };

      const result = await service.createIssue(input);

      expect(result.key).toBe('TEST-1');
      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'TEST' },
          issuetype: { name: 'Story' },
          summary: 'Test issue',
        },
      });
    });

    it('creates issue with description', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        description: 'Test description',
      };

      await service.createIssue(input);

      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          description: 'Test description',
        }),
      });
    });

    it('creates issue with assignee', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        assignee: 'john.doe',
      };

      await service.createIssue(input);

      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          assignee: { name: 'john.doe' },
        }),
      });
    });

    it('creates issue with priority', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        priority: 'High',
      };

      await service.createIssue(input);

      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          priority: { name: 'High' },
        }),
      });
    });

    it('creates issue with labels', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        labels: ['frontend', 'urgent'],
      };

      await service.createIssue(input);

      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          labels: ['frontend', 'urgent'],
        }),
      });
    });

    it('creates issue with acceptance criteria using custom field', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        acceptance: '- Given X, when Y, then Z',
      };

      await service.createIssue(input);

      expect(mockFieldService.resolveFieldId).toHaveBeenCalledWith('acceptance');
      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          customfield_10001: expect.stringContaining('Given'),
        }),
      });
    });

    it('creates issue with epic link', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        epic: 'EPIC-123',
      };

      await service.createIssue(input);

      expect(mockFieldService.resolveFieldId).toHaveBeenCalledWith('epic');
      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          customfield_10002: 'EPIC-123',
        }),
      });
    });

    it('creates issue with story points', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        storyPoints: 5,
      };

      await service.createIssue(input);

      expect(mockFieldService.resolveFieldId).toHaveBeenCalledWith('storyPoints');
      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          customfield_10003: 5,
        }),
      });
    });

    it('creates issue with custom fields', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        customFields: {
          customfield_99999: 'custom value',
        },
      };

      await service.createIssue(input);

      expect(mockClient.createIssue).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          customfield_99999: 'custom value',
        }),
      });
    });

    it('throws validation error for missing project', async () => {
      const input = {
        issueType: 'Story',
        summary: 'Test issue',
      } as CreateIssueInput;

      await expect(service.createIssue(input)).rejects.toThrow(/Invalid issue input/);
    });

    it('throws validation error for missing summary', async () => {
      const input = {
        project: 'TEST',
        issueType: 'Story',
      } as CreateIssueInput;

      await expect(service.createIssue(input)).rejects.toThrow(/Invalid issue input/);
    });

    it('throws validation error for empty project', async () => {
      const input: CreateIssueInput = {
        project: '',
        issueType: 'Story',
        summary: 'Test',
      };

      await expect(service.createIssue(input)).rejects.toThrow(/Invalid issue input/);
    });
  });

  describe('updateIssue', () => {
    it('updates issue summary', async () => {
      const updates: UpdateIssueInput = {
        summary: 'Updated summary',
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: { summary: 'Updated summary' },
      });
    });

    it('updates issue description', async () => {
      const updates: UpdateIssueInput = {
        description: 'Updated description',
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: { description: 'Updated description' },
      });
    });

    it('clears assignee when set to empty string', async () => {
      const updates: UpdateIssueInput = {
        assignee: '',
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: { assignee: null },
      });
    });

    it('updates multiple fields at once', async () => {
      const updates: UpdateIssueInput = {
        summary: 'New summary',
        priority: 'Critical',
        labels: ['urgent'],
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: {
          summary: 'New summary',
          priority: { name: 'Critical' },
          labels: ['urgent'],
        },
      });
    });

    it('does not call API when no fields to update', async () => {
      const updates: UpdateIssueInput = {};

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).not.toHaveBeenCalled();
    });

    it('updates custom fields', async () => {
      const updates: UpdateIssueInput = {
        customFields: { customfield_99999: 'new value' },
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: { customfield_99999: 'new value' },
      });
    });

    it('clears epic when set to empty string', async () => {
      const updates: UpdateIssueInput = {
        epic: '',
      };

      await service.updateIssue('TEST-1', updates);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('TEST-1', {
        fields: expect.objectContaining({
          customfield_10002: null,
        }),
      });
    });
  });

  describe('getIssue', () => {
    it('retrieves issue by key', async () => {
      const result = await service.getIssue('TEST-1');

      expect(result.key).toBe('TEST-1');
      expect(mockClient.getIssue).toHaveBeenCalledWith('TEST-1', { expand: undefined });
    });

    it('passes expand parameter', async () => {
      await service.getIssue('TEST-1', ['renderedFields']);

      expect(mockClient.getIssue).toHaveBeenCalledWith('TEST-1', { expand: ['renderedFields'] });
    });
  });

  describe('formatAcceptanceAsTable option', () => {
    it('formats acceptance as table by default', async () => {
      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test',
        acceptance: '- Given user is logged in, when they click logout, then they are redirected to login page',
      };

      await service.createIssue(input);

      const createCall = (mockClient.createIssue as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.fields.customfield_10001).toContain('||');
    });

    it('does not format when disabled', async () => {
      const serviceNoFormat = new IssueService({
        client: mockClient,
        fieldService: mockFieldService,
        formatAcceptanceAsTable: false,
      });

      const input: CreateIssueInput = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test',
        acceptance: '- Given user is logged in, when they click logout, then they are redirected',
      };

      await serviceNoFormat.createIssue(input);

      const createCall = (mockClient.createIssue as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.fields.customfield_10001).toBe(input.acceptance);
    });
  });
});
