const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

function readEnvList(name) {
  const value = process.env[name];
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeMultiline(value) {
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

function mergeLabels(...sources) {
  const set = new Set();

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

function deepClone(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function markdownToPlainText(markdown) {
  if (!markdown) {
    return '';
  }

  let text = markdown.replace(/\r\n/g, '\n');

  text = text.replace(/^\s*\*\s+/gm, '- ');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/<br\s*\/?\s*>/gi, '\n');
  text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''));
  text = text.replace(/^\s*#{1,6}\s*/gm, '');
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)');

  text = text
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function decodeHtmlEntities(str) {
  if (typeof str !== 'string') {
    str = str === undefined || str === null ? '' : String(str);
  }
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'');
}

function cleanupWhitespace(text) {
  if (typeof text !== 'string') {
    text = text === undefined || text === null ? '' : String(text);
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

function formatListWithPrefix(text, prefix) {
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

function toPlainText(value) {
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
    const type = value.type;

    if (type === 'doc' || type === 'panel') {
      return cleanupWhitespace(toPlainText(value.content || []));
    }

    if (type === 'paragraph' || type === 'heading' || type === 'blockquote') {
      return cleanupWhitespace(toPlainText(value.content || []));
    }

    if (type === 'text') {
      return cleanupWhitespace(value.text || '');
    }

    if (type === 'hardBreak') {
      return '';
    }

    if (type === 'codeBlock') {
      return cleanupWhitespace(toPlainText(value.content || []));
    }

    if (type === 'bulletList') {
      const combined = (value.content || [])
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
      const combined = (value.content || [])
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
      return cleanupWhitespace(toPlainText(value.content || []));
    }

    if (value.content) {
      return cleanupWhitespace(toPlainText(value.content));
    }

    if (typeof value.text === 'string') {
      return cleanupWhitespace(value.text);
    }

    if (typeof value.value === 'string') {
      return cleanupWhitespace(value.value);
    }
  }

  return cleanupWhitespace(String(value));
}

function indentBlock(text, indent = '  ') {
  return text
    .split(/\r?\n/)
    .map((line) => (line.length ? `${indent}${line}` : line))
    .join('\n');
}

function formatUser(user, fallback = undefined) {
  if (!user) {
    return fallback;
  }
  return user.displayName || user.name || user.accountId || fallback;
}

function findFieldByName(issue, pattern) {
  const names = issue?.names || {};
  const fields = issue?.fields || {};

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

function pruneValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => pruneValue(item))
      .filter((item) => item !== undefined);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = pruneValue(val);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length ? result : undefined;
  }

  return value;
}

function buildCleanIssue(issue, cfg) {
  const fields = issue.fields || {};
  const baseUrl = cfg.baseUrl ? cfg.baseUrl.replace(/\/$/, '') : '';
  const browseUrl = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;

  const epicField = fields.customfield_15208 || fields.customfield_10008 || null;
  const epic = epicField
    ? pruneValue({
        key: epicField.key,
        summary: epicField.fields?.summary || epicField.summary || epicField.name,
      })
    : undefined;

  const storyPointsField =
    findFieldByName(issue, /story points/i) ||
    (fields.customfield_10002
      ? { label: 'Story Points', value: fields.customfield_10002 }
      : null);
  const storyPointsValue = storyPointsField ? Number(storyPointsField.value) : undefined;

  const description =
    toPlainText(fields.description) || toPlainText(issue.renderedFields?.description);
  const acceptanceField =
    findFieldByName(issue, /acceptance/i) ||
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
        body: toPlainText(comment.body || comment.renderedBody),
      })
    )
    .filter(Boolean);

  const data = {
    id: issue.id,
    key: issue.key,
    summary: fields.summary,
    description,
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
    dueDate: fields.duedate,
    labels: fields.labels && fields.labels.length ? fields.labels.slice() : undefined,
    epic,
    fixVersions: fields.fixVersions && fields.fixVersions.length
      ? fields.fixVersions.map((v) => v.name).filter(Boolean)
      : undefined,
    created: fields.created,
    updated: fields.updated,
    url: browseUrl || undefined,
    acceptanceCriteria: acceptance,
    comments: recentComments.length ? recentComments : undefined,
  };

  return pruneValue(data) || {};
}

function formatIssueForLLM(issue, cfg, precomputed) {
  const clean = precomputed || buildCleanIssue(issue, cfg);
  const lines = [];

  lines.push(
    `${clean.key} | ${clean.issueType || 'Issue'} | Status: ${clean.status || 'Unknown'} | Priority: ${
      clean.priority || 'Unspecified'
    }`
  );
  lines.push(`Summary: ${clean.summary || 'n/a'}`);

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

function escapeTableCell(value) {
  return value.replace(/\|/g, '\\|');
}

function acceptanceBulletToTableRows(text) {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
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

function formatAcceptanceAsTable(text) {
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

function parseFields(input, label) {
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
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error.message}`);
  }
}

function parseFrontMatterMarkdown(filePath) {
  const raw = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
  const match = raw.match(/^---\s*\n([\s\S]+?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(
      'Markdown file must start with a YAML front matter block delimited by --- lines'
    );
  }

  const metadata = YAML.parse(match[1]) || {};
  const body = (match[2] || '').trim();

  return { metadata, body };
}

function extractJiraOptionsFromMarkdown(filePath) {
  const { metadata, body } = parseFrontMatterMarkdown(filePath);

  const fields = typeof metadata.fields === 'object' && metadata.fields !== null
    ? deepClone(metadata.fields)
    : undefined;

  const summary =
    normalizeText(metadata.summary) ||
    normalizeText(metadata.title);

  const descriptionFromMeta = normalizeMultiline(metadata.description);
  const description = descriptionFromMeta || markdownToPlainText(body);

  const acceptance =
    normalizeMultiline(metadata.acceptance) ||
    normalizeMultiline(metadata.acceptanceCriteria);

  const labels = mergeLabels(metadata.labels);

  return {
    project: normalizeText(metadata.project) || normalizeText(metadata.projectKey),
    type: normalizeText(metadata.type) || normalizeText(metadata.issueType),
    summary,
    description: description || undefined,
    fields,
    acceptance,
    acceptanceField: normalizeText(metadata.acceptanceField),
    epic: normalizeText(metadata.epic) || normalizeText(metadata.epicKey) || normalizeText(metadata.epicLink),
    epicField: normalizeText(metadata.epicField),
    assignee: normalizeText(metadata.assignee) || normalizeText(metadata.owner),
    priority: normalizeText(metadata.priority),
    labels,
  };
}

module.exports = {
  buildCleanIssue,
  cleanupWhitespace,
  decodeHtmlEntities,
  deepClone,
  extractJiraOptionsFromMarkdown,
  findFieldByName,
  formatIssueForLLM,
  formatListWithPrefix,
  formatUser,
  indentBlock,
  markdownToPlainText,
  mergeLabels,
  normalizeMultiline,
  normalizeText,
  parseFields,
  parseFrontMatterMarkdown,
  pruneValue,
  readEnvList,
  toPlainText,
  formatAcceptanceAsTable,
  acceptanceBulletToTableRows,
};
