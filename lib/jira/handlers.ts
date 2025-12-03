import {
  buildCleanIssue,
  formatIssueForLLM,
  formatUser,
  mergeLabels,
  normalizeMultiline,
  normalizeText,
  parseFields,
  type JiraIssueLike,
} from './utils.js';
import { createJiraClientFromEnv } from './client/JiraClient.js';
import { IssueService } from './services/IssueService.js';
import { SearchService } from './services/SearchService.js';
import { FieldService } from './services/FieldService.js';
import { getJiraConfig } from '../config/loadJiraConfig.js';
import { loadCreateIssueFromJson, loadUpdateIssueFromJson } from './input/index.js';

export interface JiraCreateOptions {
  project?: string;
  type?: string;
  summary?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  labels?: string;
  epic?: string;
  acceptance?: string | string[];
  acceptanceField?: string;
  epicField?: string;
  fields?: string | Record<string, unknown>;
  fromJson?: string;
}

export interface JiraSearchOptions {
  jql?: string;
  text?: string;
  limit: number;
}

export interface JiraUpdateOptions {
  summary?: string;
  description?: string;
  fields?: string | Record<string, unknown>;
  acceptance?: string | string[];
  acceptanceField?: string;
  fromJson?: string;
}

export interface JiraGetOptions {
  fields?: string;
  expand?: string;
  llm?: boolean;
  json?: boolean;
  raw?: boolean;
}

export interface JiraTransitionOptions {
  status: string;
}

/**
 * Handle Jira issue creation using the service layer.
 * Requires --from-json to load issue details from a JSON file.
 */
export async function handleJiraCreate(opts: JiraCreateOptions): Promise<unknown> {
  if (!opts.fromJson) {
    throw new Error(
      'Missing issue input. Use --from-json <path> to load issue details from a JSON file.'
    );
  }

  const input = loadCreateIssueFromJson(opts.fromJson);

  const client = createJiraClientFromEnv();
  const config = getJiraConfig();
  const fieldService = new FieldService({ jiraConfig: config, client });
  const issueService = new IssueService({ client, fieldService });

  const labels = mergeLabels(input.labels, opts.labels);

  const project = normalizeText(opts.project) ?? input.project;
  const issueType = normalizeText(opts.type) ?? input.issueType;
  const summary = normalizeText(opts.summary) ?? input.summary;
  const description = opts.description ?? input.description;
  const assignee = normalizeText(opts.assignee) ?? input.assignee;
  const priority = normalizeText(opts.priority) ?? input.priority;
  const epic = normalizeText(opts.epic) ?? input.epic;
  const acceptance = normalizeMultiline(
    opts.acceptance !== undefined ? opts.acceptance : input.acceptance
  );
  const storyPoints = input.storyPoints;
  const customFields = {
    ...input.customFields,
    ...parseFields(opts.fields, 'fields JSON'),
  };

  const result = await issueService.createIssue({
    project: project!,
    issueType: issueType!,
    summary: summary!,
    description,
    assignee,
    priority,
    labels: labels ?? undefined,
    acceptance,
    epic,
    storyPoints,
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  });

  console.log(`Created issue ${result.key}`);
  return result;
}

/**
 * Handle Jira search using SearchService.
 */
export async function handleJiraSearch(opts: JiraSearchOptions): Promise<void> {
  const client = createJiraClientFromEnv();
  const searchService = new SearchService({ client });

  if (!opts.jql && !opts.text) {
    throw new Error('Provide either --jql or --text for search');
  }

  const result = opts.jql
    ? await searchService.searchByJql(opts.jql, { limit: opts.limit })
    : await searchService.searchByText(opts.text!, { limit: opts.limit });

  if (!result.issues.length) {
    console.log('No issues found.');
    return;
  }

  result.issues.forEach((issue) => {
    console.log(`${issue.key}: ${issue.fields.summary}`);
  });
}

/**
 * Handle Jira issue update using the service layer.
 * Requires --from-json to load updates from a JSON file, or CLI options.
 */
export async function handleJiraUpdate(
  issueIdOrKey: string,
  opts: JiraUpdateOptions
): Promise<void> {
  const client = createJiraClientFromEnv();
  const config = getJiraConfig();
  const fieldService = new FieldService({ jiraConfig: config, client });
  const issueService = new IssueService({ client, fieldService });

  let summary: string | undefined;
  let description: string | undefined;
  let acceptance: string | undefined;
  let customFields: Record<string, unknown> = {};

  if (opts.fromJson) {
    const input = loadUpdateIssueFromJson(opts.fromJson);
    summary = normalizeText(opts.summary) ?? input.summary;
    description = opts.description ?? input.description;
    acceptance = normalizeMultiline(
      opts.acceptance !== undefined ? opts.acceptance : input.acceptance
    );
    customFields = {
      ...input.customFields,
      ...parseFields(opts.fields, 'fields JSON'),
    };
  } else {
    summary = normalizeText(opts.summary);
    description = opts.description;
    acceptance = normalizeMultiline(opts.acceptance);
    customFields = parseFields(opts.fields, 'fields JSON');
  }

  if (!summary && description === undefined && !acceptance && Object.keys(customFields).length === 0) {
    throw new Error(
      'Nothing to update. Provide --summary, --description, --acceptance, --fields, or use --from-json.'
    );
  }

  await issueService.updateIssue(issueIdOrKey, {
    summary,
    description,
    acceptance,
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  });

  console.log(`Updated issue ${issueIdOrKey}`);
}

/**
 * Handle Jira issue get using new client.
 */
export async function handleJiraGet(issueIdOrKey: string, opts: JiraGetOptions): Promise<void> {
  if (opts.llm && opts.json) {
    throw new Error('--llm cannot be combined with --json');
  }

  if (opts.raw && !opts.json) {
    throw new Error('--raw requires --json');
  }

  const client = createJiraClientFromEnv();
  const host = process.env.JIRA_BASE_URL ?? process.env.JIRA_HOST ?? '';

  const expandSet = new Set<string>();
  if (opts.expand) {
    opts.expand
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => expandSet.add(value));
  }
  expandSet.add('names');
  expandSet.add('renderedFields');

  const issue = await client.getIssue(issueIdOrKey, {
    fields: opts.fields,
    expand: Array.from(expandSet),
  });

  const issueLike = issue as unknown as JiraIssueLike;
  const cleanIssue = buildCleanIssue(issueLike, { baseUrl: host });

  if (opts.llm) {
    console.log(formatIssueForLLM(issueLike, { baseUrl: host }, cleanIssue));
    return;
  }

  if (opts.json) {
    const payload = opts.raw ? issue : cleanIssue;
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const summaryLine = [
    cleanIssue.key ?? issue.key ?? issueIdOrKey,
    cleanIssue.issueType ?? issue.fields?.issuetype?.name ?? 'Issue',
    cleanIssue.summary ?? issue.fields?.summary ?? '(no summary)',
  ].join(' | ');

  console.log(summaryLine);
  console.log(`Status: ${cleanIssue.status ?? issue.fields?.status?.name ?? 'Unknown'}`);
  console.log(
    `Reporter: ${cleanIssue.reporter ?? formatUser(issue.fields?.reporter, 'Unknown') ?? 'Unknown'}`
  );
  console.log(
    `Assignee: ${
      cleanIssue.assignee ?? formatUser(issue.fields?.assignee, 'Unassigned') ?? 'Unassigned'
    }`
  );
  if (cleanIssue.priority) {
    console.log(`Priority: ${cleanIssue.priority}`);
  }
  if (cleanIssue.storyPoints !== undefined) {
    console.log(`Story Points: ${cleanIssue.storyPoints}`);
  }
  if (cleanIssue.epic) {
    const epicLine = [cleanIssue.epic.key, cleanIssue.epic.summary].filter(Boolean).join(' – ');
    if (epicLine) {
      console.log(`Epic: ${epicLine}`);
    }
  }
  if (cleanIssue.url) {
    console.log(`URL: ${cleanIssue.url}`);
  }
}

/**
 * Handle Jira issue transition (change status).
 */
export async function handleJiraTransition(
  issueIdOrKey: string,
  opts: JiraTransitionOptions
): Promise<void> {
  const client = createJiraClientFromEnv();

  const transitions = await client.getTransitions(issueIdOrKey);

  const targetStatus = opts.status.toLowerCase();
  const transition = transitions.find(
    (t) => t.name.toLowerCase() === targetStatus || t.id === opts.status
  );

  if (!transition) {
    const available = transitions.map((t) => `"${t.name}" (id: ${t.id})`).join(', ');
    throw new Error(
      `Cannot transition to "${opts.status}". Available transitions: ${available || 'none'}`
    );
  }

  await client.transitionIssue(issueIdOrKey, transition.id);
  console.log(`Transitioned ${issueIdOrKey} to "${transition.name}"`);
}
