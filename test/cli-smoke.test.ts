import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../dist/cli.js');

describe('CLI smoke tests', () => {
  it('should show help and exit 0', () => {
    const result = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
    });
    expect(result).toContain('Usage:');
    expect(result).toContain('jira-create');
    expect(result).toContain('confluence-read');
  });

  it('should show jira-create subcommand help', () => {
    const result = execSync(`node "${CLI_PATH}" jira-create --help`, {
      encoding: 'utf-8',
    });
    expect(result).toContain('--from-json');
  });
});
