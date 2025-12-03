export interface JiraUserLike {
  accountId?: string;
  name?: string;
  displayName?: string;
}

export interface JiraCommentLike {
  id?: string;
  author?: JiraUserLike | null;
  created?: string;
  body?: unknown;
  renderedBody?: unknown;
}

export interface JiraIssueFields {
  summary?: string;
  description?: unknown;
  issuetype?: { name?: string } | null;
  status?: { name?: string } | null;
  reporter?: JiraUserLike | null;
  assignee?: JiraUserLike | null;
  priority?: { name?: string } | null;
  project?: { id?: string; key?: string; name?: string } | null;
  duedate?: string | null;
  labels?: string[] | null;
  fixVersions?: Array<{ name?: string | null }> | null;
  comment?: { comments?: JiraCommentLike[] | null } | null;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface JiraIssueLike {
  id: string;
  key: string;
  fields: JiraIssueFields;
  names?: Record<string, string>;
  renderedFields?: { description?: unknown };
  [key: string]: unknown;
}

export interface CleanIssue {
  id?: string;
  key?: string;
  summary?: string;
  description?: string;
  issueType?: string;
  status?: string;
  reporter?: string;
  assignee?: string;
  priority?: string;
  storyPoints?: number;
  project?: { id?: string; key?: string; name?: string };
  dueDate?: string;
  labels?: string[];
  epic?: { key?: string; summary?: string };
  fixVersions?: string[];
  created?: string;
  updated?: string;
  url?: string;
  acceptanceCriteria?: string;
  comments?: Array<{
    id?: string;
    author?: string;
    created?: string;
    body?: string;
  }>;
}

export interface AcceptanceTableRow {
  given: string;
  when: string;
  then: string;
}

export function readEnvList(name: string): string[] {
  const value = process.env[name];
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function normalizeMultiline(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return normalizeMultiline(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .join('\n')
    );
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  const result = lines.join('\n').trim();
  return result.length ? result : undefined;
}

export function mergeLabels(
  ...sources: Array<string | string[] | undefined | null>
): string[] | undefined {
  const set = new Set<string>();

  sources.forEach((source) => {
    if (!source) {
      return;
    }

    if (Array.isArray(source)) {
      source
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
        .forEach((value) => set.add(value));
      return;
    }

    if (typeof source === 'string') {
      source
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => set.add(value));
    }
  });

  return set.size ? Array.from(set) : undefined;
}

export function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function decodeHtmlEntities(str: unknown): string {
  const s = typeof str === 'string' ? str : str === undefined || str === null ? '' : String(str);
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function cleanupWhitespace(text: unknown): string {
  const t = typeof text === 'string' ? text : text === undefined || text === null ? '' : String(text);
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

export function formatListWithPrefix(text: string, prefix: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  return lines
    .map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return prefix.trim() ? prefix : '';
      }
      const padding = idx === 0 ? prefix : ' '.repeat(prefix.length);
      return `${padding}${trimmed}`;
    })
    .join('\n');
}

interface DocNode {
  type?: string;
  content?: unknown[];
  text?: string;
  value?: string;
}

export function toPlainText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const maybeHtml = /<[^>]+>/.test(value);
    const processed = maybeHtml ? stripHtml(value) : value;
    return cleanupWhitespace(processed.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' '));
  }

  if (Array.isArray(value)) {
    const combined = value
      .map((item) => toPlainText(item))
      .filter(Boolean)
      .join('\n');
    return cleanupWhitespace(combined);
  }

  if (typeof value === 'object') {
    const node = value as DocNode;
    const type = node.type;

    if (type === 'doc' || type === 'panel') {
      return cleanupWhitespace(toPlainText(node.content ?? []));
    }

    if (type === 'paragraph' || type === 'heading' || type === 'blockquote') {
      return cleanupWhitespace(toPlainText(node.content ?? []));
    }

    if (type === 'text') {
      return cleanupWhitespace(node.text ?? '');
    }

    if (type === 'hardBreak') {
      return '';
    }

    if (type === 'codeBlock') {
      return cleanupWhitespace(toPlainText(node.content ?? []));
    }

    if (type === 'bulletList') {
      const combined = (node.content ?? [])
        .map((item) => {
          const text = toPlainText(item);
          return text ? formatListWithPrefix(text, '- ') : '';
        })
        .filter(Boolean)
        .join('\n');
      return cleanupWhitespace(combined);
    }

    if (type === 'orderedList') {
      let index = 1;
      const combined = (node.content ?? [])
        .map((item) => {
          const text = toPlainText(item);
          const prefix = `${index++}. `;
          return text ? formatListWithPrefix(text, prefix) : '';
        })
        .filter(Boolean)
        .join('\n');
      return cleanupWhitespace(combined);
    }

    if (type === 'listItem') {
      return cleanupWhitespace(toPlainText(node.content ?? []));
    }

    if (node.content) {
      return cleanupWhitespace(toPlainText(node.content));
    }

    if (typeof node.text === 'string') {
      return cleanupWhitespace(node.text);
    }

    if (typeof node.value === 'string') {
      return cleanupWhitespace(node.value);
    }
  }

  return cleanupWhitespace(String(value));
}

export function indentBlock(text: string, indent = '  '): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.length ? `${indent}${line}` : line))
    .join('\n');
}

export function formatUser(user: JiraUserLike | null | undefined, fallback?: string): string | undefined {
  if (!user) {
    return fallback;
  }
  return user.displayName ?? user.name ?? user.accountId ?? fallback;
}

interface FieldMatch {
  key: string;
  label: string;
  value: unknown;
}

export function findFieldByName(issue: JiraIssueLike, pattern: RegExp): FieldMatch | null {
  const names = issue.names ?? {};
  const fields = issue.fields;

  for (const [key, label] of Object.entries(names)) {
    if (!pattern.test(label)) {
      continue;
    }
    const value = fields[key];
    if (value === null || value === undefined || value === '') {
      continue;
    }
    return { key, label, value };
  }

  return null;
}

export function pruneValue<T>(value: T): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (trimmed.length ? trimmed : undefined) as T | undefined;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => pruneValue(item))
      .filter((item) => item !== undefined);
    return (cleaned.length ? cleaned : undefined) as T | undefined;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = pruneValue(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return (Object.keys(result).length ? result : undefined) as T | undefined;
  }

  return value;
}

export interface BuildCleanIssueConfig {
  baseUrl?: string;
}

interface EpicField {
  key?: string;
  name?: string;
  summary?: string;
  fields?: { summary?: string };
}

export function buildCleanIssue(issue: JiraIssueLike, cfg: BuildCleanIssueConfig): CleanIssue {
  const fields = issue.fields;
  const baseUrl = cfg.baseUrl ? cfg.baseUrl.replace(/\/$/, '') : '';
  const browseUrl = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;

  const epicField = (fields.customfield_15208 ?? fields.customfield_10008 ?? null) as EpicField | null;
  const epic = epicField
    ? pruneValue({
        key: epicField.key,
        summary: epicField.fields?.summary ?? epicField.summary ?? epicField.name,
      })
    : undefined;

  const storyPointsField =
    findFieldByName(issue, /story points/i) ??
    (fields.customfield_10002
      ? { label: 'Story Points', value: fields.customfield_10002 }
      : null);
  const storyPointsValue = storyPointsField ? Number(storyPointsField.value) : undefined;

  const description =
    toPlainText(fields.description) || toPlainText(issue.renderedFields?.description);
  const acceptanceField =
    findFieldByName(issue, /acceptance/i) ??
    (fields.customfield_10201
      ? { label: 'Acceptance Criteria', value: fields.customfield_10201 }
      : null);
  const acceptance = acceptanceField ? toPlainText(acceptanceField.value) : undefined;

  const comments = Array.isArray(fields.comment?.comments) ? fields.comment.comments : [];
  const recentComments = comments
    .slice(-2)
    .map((comment) =>
      pruneValue({
        id: comment.id,
        author: formatUser(comment.author),
        created: comment.created,
        body: toPlainText(comment.body ?? comment.renderedBody),
      })
    )
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  const data: CleanIssue = {
    id: issue.id,
    key: issue.key,
    summary: fields.summary,
    description: description || undefined,
    issueType: fields.issuetype?.name,
    status: fields.status?.name,
    reporter: formatUser(fields.reporter),
    assignee: formatUser(fields.assignee, 'Unassigned'),
    priority: fields.priority?.name,
    storyPoints: Number.isFinite(storyPointsValue) ? storyPointsValue : undefined,
    project: fields.project
      ? pruneValue({
          id: fields.project.id,
          key: fields.project.key,
          name: fields.project.name,
        })
      : undefined,
    dueDate: fields.duedate ?? undefined,
    labels: fields.labels?.length ? fields.labels.slice() : undefined,
    epic,
    fixVersions:
      fields.fixVersions?.length
        ? fields.fixVersions.map((v) => v.name).filter((n): n is string => Boolean(n))
        : undefined,
    created: fields.created,
    updated: fields.updated,
    url: browseUrl ?? undefined,
    acceptanceCriteria: acceptance,
    comments: recentComments.length ? recentComments : undefined,
  };

  return pruneValue(data) ?? {};
}

export function formatIssueForLLM(
  issue: JiraIssueLike,
  cfg: BuildCleanIssueConfig,
  precomputed?: CleanIssue
): string {
  const clean = precomputed ?? buildCleanIssue(issue, cfg);
  const lines: string[] = [];

  lines.push(
    `${clean.key} | ${clean.issueType ?? 'Issue'} | Status: ${clean.status ?? 'Unknown'} | Priority: ${
      clean.priority ?? 'Unspecified'
    }`
  );
  lines.push(`Summary: ${clean.summary ?? 'n/a'}`);

  if (clean.project) {
    const projectLine = clean.project.name
      ? `${clean.project.key} – ${clean.project.name}`
      : clean.project.key;
    if (projectLine) {
      lines.push(`Project: ${projectLine}`);
    }
  }

  if (clean.reporter) lines.push(`Reporter: ${clean.reporter}`);
  if (clean.assignee) lines.push(`Assignee: ${clean.assignee}`);
  if (clean.labels) lines.push(`Labels: ${clean.labels.join(', ')}`);
  if (clean.epic) {
    const epicLine = [clean.epic.key, clean.epic.summary].filter(Boolean).join(' – ');
    if (epicLine) lines.push(`Epic: ${epicLine}`);
  }
  if (clean.storyPoints !== undefined) lines.push(`Story Points: ${clean.storyPoints}`);
  if (clean.dueDate) lines.push(`Due: ${clean.dueDate}`);
  if (clean.fixVersions) lines.push(`Fix Versions: ${clean.fixVersions.join(', ')}`);
  if (clean.created) lines.push(`Created: ${clean.created}`);
  if (clean.updated) lines.push(`Updated: ${clean.updated}`);
  if (clean.url) lines.push(`URL: ${clean.url}`);

  if (clean.description) {
    lines.push('');
    lines.push(`Description:\n${indentBlock(clean.description)}`);
  }

  if (clean.acceptanceCriteria) {
    lines.push('');
    lines.push(`Acceptance Criteria:\n${indentBlock(clean.acceptanceCriteria)}`);
  }

  if (clean.comments) {
    lines.push('');
    lines.push(`Recent Comments (${clean.comments.length} shown):`);
    for (const comment of clean.comments) {
      const parts = [
        comment.author,
        comment.created ? new Date(comment.created).toISOString().replace(/T.*/, '') : null,
      ]
        .filter(Boolean)
        .join(' @ ');
      const body = comment.body ? indentBlock(comment.body, '    ') : '';
      lines.push(`- ${parts || 'Comment'}${body ? `\n${body}` : ''}`);
    }
  }

  return lines.join('\n').trim();
}

export function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

export function acceptanceBulletToTableRows(text: string): AcceptanceTableRow[] | null {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: AcceptanceTableRow[] = [];
  const pattern = /^-?\s*Given\s+(.*?),\s*when\s+(.*?),\s*then\s+(.*)$/i;

  lines.forEach((line) => {
    const match = line.match(pattern);
    if (!match) {
      return;
    }

    const given = match[1].trim();
    const when = match[2].trim();
    let then = match[3].trim();

    if (then.endsWith('.')) {
      then = then.slice(0, -1);
    }

    rows.push({
      given: escapeTableCell(given),
      when: escapeTableCell(when),
      then: escapeTableCell(then),
    });
  });

  return rows.length ? rows : null;
}

export function formatAcceptanceAsTable(text: string | undefined): string | undefined {
  if (!text) return text;
  const rows = acceptanceBulletToTableRows(text);
  if (!rows) {
    return text;
  }

  const header = '|| *Given* || *When* || *Then* ||';
  const body = rows
    .map((row) => `| ${row.given} | ${row.when} | ${row.then} |`)
    .join('\n');

  return `${header}\n${body}`;
}

export function parseFields(
  input: string | Record<string, unknown> | undefined | null,
  label: string
): Record<string, unknown> {
  if (!input) {
    return {};
  }

  if (typeof input !== 'string') {
    if (typeof input === 'object') {
      return input;
    }
    throw new Error(`Unsupported ${label} format: expected string or object`);
  }

  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${label}: ${message}`);
  }
}
