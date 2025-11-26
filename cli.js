#!/usr/bin/env node

const { Command } = require('commander');

const { loadEnv } = require('./lib/env');
const { handleError } = require('./lib/error');
const {
  handleJiraCreate,
  handleJiraGet,
  handleJiraSearch,
  handleJiraUpdate,
} = require('./lib/jira/handlers');
const {
  handleConfluenceCreate,
  handleConfluenceRead,
  handleConfluenceUpdate,
} = require('./lib/confluence');

loadEnv();

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
  .option(
    '--from-markdown <path>',
    'Load issue details from a markdown file with YAML front matter'
  )
  .action((opts) => handleJiraCreate(opts).catch(handleError));

program
  .command('jira-search')
  .description('Search Jira issues')
  .option('--jql <query>', 'Explicit JQL query')
  .option('--text <phrase>', 'Simple text search (wraps into JQL)')
  .option('--limit <n>', 'Maximum results', (value) => Number(value), 10)
  .action((opts) => handleJiraSearch(opts).catch(handleError));

program
  .command('jira-update <issueIdOrKey>')
  .description('Update a Jira issue')
  .option('--summary <summary>', 'New summary')
  .option('--description <description>', 'New description')
  .option('--fields <json>', 'Arbitrary fields JSON blob')
  .option('--acceptance <text>', 'Acceptance criteria text (table generated automatically)')
  .option('--acceptance-field <id>', 'Custom field for acceptance criteria')
  .option(
    '--from-markdown <path>',
    'Load updates from a markdown file with YAML front matter'
  )
  .action((issueIdOrKey, opts) => handleJiraUpdate(issueIdOrKey, opts).catch(handleError));

program
  .command('jira-get <issueIdOrKey>')
  .description('Fetch a Jira issue by key or ID')
  .option('--fields <list>', 'Comma-separated list of fields to include')
  .option('--expand <list>', 'Comma-separated list of entities to expand')
  .option('--llm', 'Output condensed summary for LLM consumption')
  .option('--json', 'Output full JSON payload')
  .option('--raw', 'When used with --json, output the raw Jira response')
  .action((issueIdOrKey, opts) => handleJiraGet(issueIdOrKey, opts).catch(handleError));

program
  .command('confluence-read')
  .description('Read a Confluence page')
  .option('--id <id>', 'Page ID')
  .option('--space <key>', 'Space key')
  .option('--title <title>', 'Page title')
  .action((opts) => handleConfluenceRead(opts).catch(handleError));

program
  .command('confluence-update')
  .description('Update a Confluence page body or title')
  .requiredOption('--id <id>', 'Page ID')
  .option('--title <title>', 'New title')
  .option('--body <storage>', 'Storage-format body')
  .option('--body-file <path>', 'File containing storage-format body')
  .action((opts) => handleConfluenceUpdate(opts).catch(handleError));

program
  .command('confluence-create')
  .description('Create a Confluence page')
  .requiredOption('--space <key>', 'Space key')
  .requiredOption('--title <title>', 'Page title')
  .option('--body <storage>', 'Storage-format body')
  .option('--body-file <path>', 'File containing storage-format body')
  .option('--parent <id>', 'Parent page ID')
  .action((opts) => handleConfluenceCreate(opts).catch(handleError));

program.parseAsync().catch(handleError);
