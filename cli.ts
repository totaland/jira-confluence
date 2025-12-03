#!/usr/bin/env node

import { Command } from 'commander';

import { loadEnv } from './lib/env.js';
import { handleError } from './lib/error.js';
import {
  handleJiraCreate,
  handleJiraGet,
  handleJiraSearch,
  handleJiraTransition,
  handleJiraUpdate,
  type JiraCreateOptions,
  type JiraGetOptions,
  type JiraSearchOptions,
  type JiraTransitionOptions,
  type JiraUpdateOptions,
} from './lib/jira/handlers.js';
import {
  handleConfluenceCreate,
  handleConfluenceRead,
  handleConfluenceSearch,
  handleConfluenceUpdate,
  type ConfluenceCreateOptions,
  type ConfluenceReadOptions,
  type ConfluenceSearchOptions,
  type ConfluenceUpdateOptions,
} from './lib/confluence/index.js';

loadEnv();

function run(action: () => Promise<unknown>): void {
  void action().catch(handleError);
}

const program = new Command()
  .name('jira-confluence')
  .description('CLI helper for Jira and Confluence operations');

program
  .command('jira-create')
  .description('Create a Jira issue')
  .option('--project <key>', 'Jira project key')
  .option('--type <name>', 'Issue type name')
  .option('--summary <summary>', 'Issue summary')
  .option('--description <description>', 'Issue description')
  .option('--assignee <username>', 'Issue assignee username')
  .option('--priority <name>', 'Issue priority')
  .option('--labels <csv>', 'Comma-separated labels')
  .option('--epic <key>', 'Epic key to link')
  .option('--acceptance <text>', 'Acceptance criteria text')
  .option('--acceptance-field <id>', 'Custom field for acceptance criteria')
  .option('--epic-field <id>', 'Custom field for linking epics')
  .option('--fields <json>', 'Additional fields JSON blob')
  .option('--from-json <path>', 'Load issue details from a JSON file')
  .action((opts: JiraCreateOptions) => run(() => handleJiraCreate(opts)));

program
  .command('jira-search')
  .description('Search Jira issues')
  .option('--jql <query>', 'Explicit JQL query')
  .option('--text <phrase>', 'Simple text search (wraps into JQL)')
  .option('--limit <n>', 'Maximum results', (value) => Number(value), 10)
  .action((opts: JiraSearchOptions) => run(() => handleJiraSearch(opts)));

program
  .command('jira-update <issueIdOrKey>')
  .description('Update a Jira issue')
  .option('--summary <summary>', 'New summary')
  .option('--description <description>', 'New description')
  .option('--fields <json>', 'Arbitrary fields JSON blob')
  .option('--acceptance <text>', 'Acceptance criteria text (table generated automatically)')
  .option('--acceptance-field <id>', 'Custom field for acceptance criteria')
  .option('--from-json <path>', 'Load updates from a JSON file')
  .action((issueIdOrKey: string, opts: JiraUpdateOptions) =>
    run(() => handleJiraUpdate(issueIdOrKey, opts))
  );

program
  .command('jira-get <issueIdOrKey>')
  .description('Fetch a Jira issue by key or ID')
  .option('--fields <list>', 'Comma-separated list of fields to include')
  .option('--expand <list>', 'Comma-separated list of entities to expand')
  .option('--llm', 'Output condensed summary for LLM consumption')
  .option('--json', 'Output full JSON payload')
  .option('--raw', 'When used with --json, output the raw Jira response')
  .action((issueIdOrKey: string, opts: JiraGetOptions) =>
    run(() => handleJiraGet(issueIdOrKey, opts))
  );

program
  .command('jira-transition <issueIdOrKey>')
  .description('Transition a Jira issue to a new status')
  .requiredOption('--status <name>', 'Target status name (e.g., "Done", "In Progress")')
  .action((issueIdOrKey: string, opts: JiraTransitionOptions) =>
    run(() => handleJiraTransition(issueIdOrKey, opts))
  );

program
  .command('confluence-read')
  .description('Read a Confluence page')
  .option('--id <id>', 'Page ID')
  .option('--space <key>', 'Space key')
  .option('--title <title>', 'Page title')
  .action((opts: ConfluenceReadOptions) => run(() => handleConfluenceRead(opts)));

program
  .command('confluence-update')
  .description('Update a Confluence page body or title')
  .requiredOption('--id <id>', 'Page ID')
  .option('--title <title>', 'New title')
  .option('--body <storage>', 'Storage-format body')
  .option('--body-file <path>', 'File containing storage-format body')
  .action((opts: ConfluenceUpdateOptions) => run(() => handleConfluenceUpdate(opts)));

program
  .command('confluence-create')
  .description('Create a Confluence page')
  .requiredOption('--space <key>', 'Space key')
  .requiredOption('--title <title>', 'Page title')
  .option('--body <storage>', 'Storage-format body')
  .option('--body-file <path>', 'File containing storage-format body')
  .option('--parent <id>', 'Parent page ID')
  .action((opts: ConfluenceCreateOptions) => run(() => handleConfluenceCreate(opts)));

program
  .command('confluence-search')
  .description('Search Confluence pages')
  .option('--cql <query>', 'Explicit CQL query')
  .option('--text <phrase>', 'Simple text search (wraps into CQL)')
  .option('--space <key>', 'Limit search to a specific space')
  .option('--limit <n>', 'Maximum results', (value) => Number(value), 10)
  .option('--read', 'Automatically read the first matching page')
  .action((opts: ConfluenceSearchOptions) => run(() => handleConfluenceSearch(opts)));

void program.parseAsync().catch(handleError);
