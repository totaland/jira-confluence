import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldService, type LogicalFieldName } from '../../../lib/jira/services/FieldService.js';
import type { JiraClient } from '../../../lib/jira/client/JiraClient.js';
import type { JiraField } from '../../../lib/jira/client/types.js';
import type { JiraConfig } from '../../../lib/config/jira.js';

function createMockClient(fields: JiraField[] = []): JiraClient {
  return {
    listFields: vi.fn().mockResolvedValue(fields),
    getIssue: vi.fn(),
    search: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    getUnderlyingClient: vi.fn(),
  } as unknown as JiraClient;
}

function createField(id: string, name: string, custom = true): JiraField {
  return { id, name, custom };
}

describe('FieldService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveFieldId with configured mapping', () => {
    it('returns configured field ID when available', async () => {
      const config: JiraConfig = {
        apiVersion: '2',
        fieldMapping: {
          acceptance: 'customfield_12345',
        },
      };

      const service = new FieldService({ jiraConfig: config });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBe('customfield_12345');
    });

    it('returns configured ID without calling API', async () => {
      const mockClient = createMockClient([]);
      const config: JiraConfig = {
        apiVersion: '2',
        fieldMapping: {
          epic: 'customfield_epic',
        },
      };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('epic');

      expect(result).toBe('customfield_epic');
      expect(mockClient.listFields).not.toHaveBeenCalled();
    });
  });

  describe('resolveFieldId with fallback discovery', () => {
    it('discovers acceptance field by exact name match', async () => {
      const fields = [
        createField('customfield_10001', 'Acceptance Criteria'),
        createField('customfield_10002', 'Story Points'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBe('customfield_10001');
      expect(mockClient.listFields).toHaveBeenCalled();
    });

    it('discovers epic field by pattern match', async () => {
      const fields = [
        createField('customfield_10100', 'Epic Link'),
        createField('customfield_10200', 'Description'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('epic');

      expect(result).toBe('customfield_10100');
    });

    it('discovers story points field', async () => {
      const fields = [
        createField('customfield_10105', 'Story Points'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('storyPoints');

      expect(result).toBe('customfield_10105');
    });

    it('discovers sprint field', async () => {
      const fields = [
        createField('customfield_10020', 'Sprint'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('sprint');

      expect(result).toBe('customfield_10020');
    });

    it('returns undefined when field not found', async () => {
      const fields = [
        createField('customfield_10001', 'Unrelated Field'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBeUndefined();
    });

    it('returns undefined when no client provided', async () => {
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBeUndefined();
    });

    it('uses custom candidates from config', async () => {
      const fields = [
        createField('customfield_99999', 'My Custom Acceptance'),
      ];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = {
        apiVersion: '2',
        fieldMapping: {},
        acceptanceFieldCandidates: ['My Custom Acceptance'],
      };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBe('customfield_99999');
    });
  });

  describe('assertFieldId', () => {
    it('returns field ID when found', async () => {
      const config: JiraConfig = {
        apiVersion: '2',
        fieldMapping: {
          acceptance: 'customfield_12345',
        },
      };

      const service = new FieldService({ jiraConfig: config });
      const result = await service.assertFieldId('acceptance');

      expect(result).toBe('customfield_12345');
    });

    it('throws validation error when field not found', async () => {
      const mockClient = createMockClient([]);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });

      await expect(service.assertFieldId('acceptance')).rejects.toThrow(
        /Unable to resolve field ID for "acceptance"/
      );
    });
  });

  describe('caching', () => {
    it('caches listFields call', async () => {
      const fields = [createField('customfield_10001', 'Acceptance Criteria')];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });

      await service.resolveFieldId('acceptance');
      await service.resolveFieldId('epic');

      expect(mockClient.listFields).toHaveBeenCalledTimes(1);
    });

    it('clearCache forces new API call', async () => {
      const fields = [createField('customfield_10001', 'Acceptance Criteria')];
      const mockClient = createMockClient(fields);
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });

      await service.resolveFieldId('acceptance');
      service.clearCache();
      await service.resolveFieldId('acceptance');

      expect(mockClient.listFields).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('returns undefined when listFields throws', async () => {
      const mockClient = {
        listFields: vi.fn().mockRejectedValue(new Error('API error')),
      } as unknown as JiraClient;
      const config: JiraConfig = { apiVersion: '2', fieldMapping: {} };

      const service = new FieldService({ jiraConfig: config, client: mockClient });
      const result = await service.resolveFieldId('acceptance');

      expect(result).toBeUndefined();
    });
  });
});
