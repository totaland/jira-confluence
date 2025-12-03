import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import {
  loadIssueFromJson,
  loadCreateIssueFromJson,
  loadUpdateIssueFromJson,
  parseIssueInputFromString,
} from '../../../lib/jira/input/loadIssueFromJson.js';
import { AppError } from '../../../lib/error.js';

const TEST_DIR = path.join(process.cwd(), 'test-fixtures');
const TEST_FILE = path.join(TEST_DIR, 'test-issue.json');

describe('loadIssueFromJson', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  describe('loadIssueFromJson', () => {
    it('loads and validates a valid create issue input', () => {
      const input = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
        description: 'A test description',
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.project).toBe('TEST');
      expect(result.issueType).toBe('Story');
      expect(result.summary).toBe('Test issue');
      expect(result.description).toBe('A test description');
    });

    it('normalizes type to issueType', () => {
      const input = {
        project: 'TEST',
        type: 'Bug',
        summary: 'Test bug',
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.issueType).toBe('Bug');
      expect(result.type).toBeUndefined();
    });

    it('normalizes fields to customFields', () => {
      const input = {
        project: 'TEST',
        type: 'Story',
        summary: 'Test',
        fields: { customfield_123: 'value' },
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.customFields).toEqual({ customfield_123: 'value' });
      expect(result.fields).toBeUndefined();
    });

    it('converts comma-separated labels to array', () => {
      const input = {
        project: 'TEST',
        type: 'Story',
        summary: 'Test',
        labels: 'label1, label2, label3',
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.labels).toEqual(['label1', 'label2', 'label3']);
    });

    it('keeps labels as array if already array', () => {
      const input = {
        project: 'TEST',
        type: 'Story',
        summary: 'Test',
        labels: ['label1', 'label2'],
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.labels).toEqual(['label1', 'label2']);
    });

    it('joins acceptance array into string', () => {
      const input = {
        project: 'TEST',
        type: 'Story',
        summary: 'Test',
        acceptance: ['Given a user', 'When they click', 'Then it works'],
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'create' });

      expect(result.acceptance).toBe('Given a user\nWhen they click\nThen it works');
    });

    it('throws AppError.config for missing file', () => {
      expect(() => loadIssueFromJson('/nonexistent/file.json')).toThrow(AppError);
      try {
        loadIssueFromJson('/nonexistent/file.json');
      } catch (error) {
        expect(AppError.isAppError(error)).toBe(true);
        expect((error as AppError).code).toBe('CONFIG_ERROR');
      }
    });

    it('throws AppError.config for invalid JSON', () => {
      writeFileSync(TEST_FILE, 'not valid json');

      expect(() => loadIssueFromJson(TEST_FILE)).toThrow(AppError);
      try {
        loadIssueFromJson(TEST_FILE);
      } catch (error) {
        expect(AppError.isAppError(error)).toBe(true);
        expect((error as AppError).code).toBe('CONFIG_ERROR');
      }
    });

    it('throws AppError.validation for missing required create fields', () => {
      const input = { project: 'TEST' }; // missing issueType and summary
      writeFileSync(TEST_FILE, JSON.stringify(input));

      expect(() => loadIssueFromJson(TEST_FILE, { mode: 'create' })).toThrow(AppError);
      try {
        loadIssueFromJson(TEST_FILE, { mode: 'create' });
      } catch (error) {
        expect(AppError.isAppError(error)).toBe(true);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('allows partial update input', () => {
      const input = { summary: 'Updated summary' };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadIssueFromJson(TEST_FILE, { mode: 'update' });

      expect(result.summary).toBe('Updated summary');
    });
  });

  describe('loadCreateIssueFromJson', () => {
    it('loads a valid create issue', () => {
      const input = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadCreateIssueFromJson(TEST_FILE);

      expect(result.project).toBe('TEST');
      expect(result.issueType).toBe('Story');
      expect(result.summary).toBe('Test issue');
    });
  });

  describe('loadUpdateIssueFromJson', () => {
    it('loads a valid update issue', () => {
      const input = {
        summary: 'Updated summary',
        description: 'Updated description',
      };
      writeFileSync(TEST_FILE, JSON.stringify(input));

      const result = loadUpdateIssueFromJson(TEST_FILE);

      expect(result.summary).toBe('Updated summary');
      expect(result.description).toBe('Updated description');
    });
  });

  describe('parseIssueInputFromString', () => {
    it('parses valid JSON string', () => {
      const input = {
        project: 'TEST',
        issueType: 'Story',
        summary: 'Test issue',
      };

      const result = parseIssueInputFromString(JSON.stringify(input), { mode: 'create' });

      expect(result.project).toBe('TEST');
      expect(result.issueType).toBe('Story');
      expect(result.summary).toBe('Test issue');
    });

    it('throws for invalid JSON string', () => {
      expect(() => parseIssueInputFromString('not json')).toThrow(AppError);
    });

    it('normalizes input when parsing from string', () => {
      const input = {
        project: 'TEST',
        type: 'Bug',
        summary: 'Test',
        labels: 'a, b, c',
      };

      const result = parseIssueInputFromString(JSON.stringify(input), { mode: 'create' });

      expect(result.issueType).toBe('Bug');
      expect(result.labels).toEqual(['a', 'b', 'c']);
    });
  });
});
