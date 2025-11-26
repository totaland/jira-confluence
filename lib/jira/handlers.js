import {
  buildCleanIssue,
  deepClone,
  extractJiraOptionsFromMarkdown,
  formatAcceptanceAsTable,
  formatIssueForLLM,
  formatUser,
  mergeLabels,
  normalizeMultiline,
  normalizeText,
  parseFields,
  readEnvList,
} from './utils.js';
import {
  ACCEPTANCE_FIELD_DEFAULTS,
  EPIC_FIELD_DEFAULTS,
  EPIC_STRING_FIELD_DEFAULTS,
} from './constants.js';
import { createJiraClient } from './client.js';

export async function handleJiraCreate(opts) {
  let fileOptions = {};

  if (opts.fromMarkdown) {
    fileOptions = extractJiraOptionsFromMarkdown(opts.fromMarkdown);
  }

  const projectKey =
    normalizeText(opts.project) ||
    normalizeText(fileOptions.project) ||
    normalizeText(process.env.JIRA_DEFAULT_PROJECT);
  const issueType = normalizeText(opts.type) || normalizeText(fileOptions.type);
  const summary = normalizeText(opts.summary) || normalizeText(fileOptions.summary);

  if (!projectKey) {
    throw new Error(
      'Missing project key. Provide --project, set "project" in the markdown front matter, or configure JIRA_DEFAULT_PROJECT.'
    );
  }

  if (!issueType) {
    throw new Error('Missing issue type. Provide --type or set "type" in the markdown front matter.');
  }

  if (!summary) {
    throw new Error(
      'Missing summary. Provide --summary or set "summary" in the markdown front matter.'
    );
  }

  const mergedFields = {
    ...parseFields(fileOptions.fields, 'fields JSON'),
    ...parseFields(opts.fields, 'fields JSON'),
  };

  const description =
    opts.description !== undefined ? opts.description : fileOptions.description;

  const labelSources = [];
  if (mergedFields.labels !== undefined) {
    labelSources.push(mergedFields.labels);
    delete mergedFields.labels;
  }

  if (fileOptions.labels) {
    labelSources.push(fileOptions.labels);
  }

  if (opts.labels) {
    labelSources.push(opts.labels);
  }

  const labels = mergeLabels(...labelSources);

  const assignee =
    normalizeText(opts.assignee) || normalizeText(fileOptions.assignee);
  const priority =
    normalizeText(opts.priority) || normalizeText(fileOptions.priority);
  const epicKey =
    normalizeText(opts.epic) || normalizeText(fileOptions.epic);
  const acceptance =
    normalizeMultiline(opts.acceptance !== undefined ? opts.acceptance : fileOptions.acceptance);
  const acceptanceTable = formatAcceptanceAsTable(acceptance);
  const acceptanceFieldPreference =
    normalizeText(opts.acceptanceField) || normalizeText(fileOptions.acceptanceField);
  const epicFieldPreference =
    normalizeText(opts.epicField) || normalizeText(fileOptions.epicField);

  const client = createJiraClient();

  const baseFields = {
    ...mergedFields,
    project: { key: projectKey },
    issuetype: { name: issueType },
    summary,
  };

  if (description) {
    baseFields.description = description;
  }

  if (assignee && baseFields.assignee === undefined) {
    baseFields.assignee = { name: assignee };
  }

  if (priority && baseFields.priority === undefined) {
    baseFields.priority = { name: priority };
  }

  if (labels && labels.length) {
    baseFields.labels = labels;
  }

  const acceptanceFieldCandidates = [
    acceptanceFieldPreference,
    normalizeText(process.env.JIRA_ACCEPTANCE_FIELD),
    ...readEnvList('JIRA_ACCEPTANCE_FIELDS'),
    ...ACCEPTANCE_FIELD_DEFAULTS,
  ].filter(Boolean);

  const epicFieldCandidates = [
    epicFieldPreference,
    normalizeText(process.env.JIRA_EPIC_FIELD),
    ...readEnvList('JIRA_EPIC_FIELDS'),
    ...EPIC_FIELD_DEFAULTS,
  ].filter(Boolean);

  const epicStringFieldSet = new Set([
    ...readEnvList('JIRA_EPIC_STRING_FIELDS'),
    ...EPIC_STRING_FIELD_DEFAULTS,
  ]);

  let acceptanceFieldIndex = 0;
  let acceptanceFieldId = acceptanceFieldCandidates.length
    ? acceptanceFieldCandidates[0]
    : undefined;

  let epicFieldIndex = 0;
  let epicFieldId = epicFieldCandidates.length ? epicFieldCandidates[0] : undefined;

  let includeAcceptance = Boolean(acceptanceFieldId && acceptance);
  let includeEpic = Boolean(epicFieldId && epicKey);
  let epicAsString = epicFieldId ? epicStringFieldSet.has(epicFieldId) : false;

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fieldsPayload = deepClone(baseFields) || {};

    if (includeAcceptance && acceptanceFieldId) {
      fieldsPayload[acceptanceFieldId] = acceptanceTable || acceptance;
    }

    if (includeEpic && epicFieldId) {
      fieldsPayload[epicFieldId] = epicAsString ? epicKey : { key: epicKey };
    }

    try {
      const issue = await client.issues.createIssue({ fields: fieldsPayload });
      console.log(`Created issue ${issue.key}`);
      return issue;
    } catch (error) {
      lastError = error;
      const responseData = error?.response?.data || {};
      const fieldErrors = responseData.errors || {};
      const generalMessages = Array.isArray(responseData.errorMessages)
        ? responseData.errorMessages
        : [];

      let adjusted = false;

      if (includeAcceptance && acceptanceFieldId && fieldErrors[acceptanceFieldId]) {
        const nextIndex = acceptanceFieldIndex + 1;
        if (nextIndex < acceptanceFieldCandidates.length) {
          const previousFieldId = acceptanceFieldId;
          acceptanceFieldIndex = nextIndex;
          acceptanceFieldId = acceptanceFieldCandidates[acceptanceFieldIndex];
          console.warn(
            `Acceptance field ${previousFieldId} rejected the value (${fieldErrors[previousFieldId]}). Trying ${acceptanceFieldId} instead.`
          );
        } else {
          console.warn(
            `Acceptance field ${acceptanceFieldId} rejected the value (${fieldErrors[acceptanceFieldId]}). Removing and retrying without acceptance criteria.`
          );
          includeAcceptance = false;
        }
        adjusted = true;
      }

      if (includeEpic && epicFieldId) {
        const epicFieldError = fieldErrors[epicFieldId];
        const combinedMessages = [];

        if (typeof epicFieldError === 'string') {
          combinedMessages.push(epicFieldError);
        }

        generalMessages
          .filter((message) => typeof message === 'string')
          .forEach((message) => combinedMessages.push(message));

        const requiresString =
          !epicAsString &&
          combinedMessages.some((message) => /string value expected/i.test(message));

        if (requiresString) {
          epicAsString = true;
          console.info(`Retrying epic field ${epicFieldId} with string payload.`);
          adjusted = true;
        } else if (epicFieldError) {
          const nextIndex = epicFieldIndex + 1;
          if (nextIndex < epicFieldCandidates.length) {
            const previousFieldId = epicFieldId;
            epicFieldIndex = nextIndex;
            epicFieldId = epicFieldCandidates[epicFieldIndex];
            epicAsString = epicStringFieldSet.has(epicFieldId);
            console.warn(
              `Epic field ${previousFieldId} rejected the value (${epicFieldError}). Trying ${epicFieldId} instead.`
            );
          } else {
            console.warn(
              `Epic field ${epicFieldId} rejected the value (${epicFieldError}). Removing and retrying without an epic link.`
            );
            includeEpic = false;
          }
          adjusted = true;
        }
      }

      if (!adjusted) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Failed to create Jira issue.');
}

export async function handleJiraSearch(opts) {
  const client = createJiraClient();

  let jql = opts.jql;
  if (!jql) {
    if (!opts.text) {
      throw new Error('Provide either --jql or --text for search');
    }
    jql = `text ~ "${opts.text}"`;
  }

  let response = await client.issueSearch.searchForIssuesUsingJql({
    jql,
    maxResults: opts.limit,
  });

  if (typeof response === 'string') {
    if (response.trim().startsWith('<')) {
      throw new Error(
        'Jira search returned HTML (likely a login page). Verify bearer/basic auth credentials in your environment.'
      );
    }

    try {
      response = JSON.parse(response);
    } catch (parseError) {
      throw new Error(`Unexpected Jira search response string: ${parseError.message}`);
    }
  }

  if (!response || !Array.isArray(response.issues)) {
    console.error('Unexpected Jira search response:');
    console.error(JSON.stringify(response, null, 2));
    throw new Error('Jira search response did not include an issues array.');
  }

  if (!response.issues.length) {
    console.log('No issues found.');
    return;
  }

  response.issues.forEach((issue) => {
    console.log(`${issue.key}: ${issue.fields.summary}`);
  });
}

export async function handleJiraUpdate(issueIdOrKey, opts) {
  let fileOptions = {};

  if (opts.fromMarkdown) {
    fileOptions = extractJiraOptionsFromMarkdown(opts.fromMarkdown);
  }

  const fields = {
    ...parseFields(fileOptions.fields, 'fields JSON'),
    ...parseFields(opts.fields, 'fields JSON'),
  };

  const summary = normalizeText(opts.summary) || normalizeText(fileOptions.summary);
  if (summary) {
    fields.summary = summary;
  }

  const description =
    opts.description !== undefined ? opts.description : fileOptions.description;
  if (description !== undefined) {
    fields.description = description;
  }

  const acceptance =
    normalizeMultiline(opts.acceptance !== undefined ? opts.acceptance : fileOptions.acceptance);
  const acceptanceFieldPreference =
    normalizeText(opts.acceptanceField) || normalizeText(fileOptions.acceptanceField);

  if (acceptance) {
    const acceptanceTable = formatAcceptanceAsTable(acceptance);
    const acceptanceFieldCandidates = [
      acceptanceFieldPreference,
      normalizeText(process.env.JIRA_ACCEPTANCE_FIELD),
      ...readEnvList('JIRA_ACCEPTANCE_FIELDS'),
      ...ACCEPTANCE_FIELD_DEFAULTS,
    ].filter(Boolean);

    const acceptanceFieldId = acceptanceFieldCandidates[0];
    if (!acceptanceFieldId) {
      console.warn(
        'Acceptance text provided but no acceptance field configured. Set --acceptance-field or environment variable to apply it.'
      );
    } else {
      fields[acceptanceFieldId] = acceptanceTable || acceptance;
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new Error(
      'Nothing to update. Provide --summary, --description, --acceptance, --fields, or use --from-markdown.'
    );
  }

  const client = createJiraClient();

  await client.issues.editIssue({
    issueIdOrKey,
    fields,
  });

  console.log(`Updated issue ${issueIdOrKey}`);
}

export async function handleJiraGet(issueIdOrKey, opts) {
  if (opts.llm && opts.json) {
    throw new Error('--llm cannot be combined with --json');
  }

  if (opts.raw && !opts.json) {
    throw new Error('--raw requires --json');
  }

  const client = createJiraClient();
  const host = process.env.JIRA_BASE_URL || process.env.JIRA_HOST || '';

  const params = {
    issueIdOrKey,
  };

  if (opts.fields) {
    params.fields = opts.fields;
  }

  const expandSet = new Set();
  if (opts.expand) {
    opts.expand
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => expandSet.add(value));
  }
  expandSet.add('names');
  expandSet.add('renderedFields');
  params.expand = Array.from(expandSet).join(',');

  const issue = await client.issues.getIssue(params);
  const cleanIssue = buildCleanIssue(issue, { baseUrl: host });

  if (opts.llm) {
    console.log(formatIssueForLLM(issue, { baseUrl: host }, cleanIssue));
    return;
  }

  if (opts.json) {
    const payload = opts.raw ? issue : cleanIssue;
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const summaryLine = [
    cleanIssue.key || issue.key || issueIdOrKey,
    cleanIssue.issueType || issue.fields?.issuetype?.name || 'Issue',
    cleanIssue.summary || issue.fields?.summary || '(no summary)',
  ].join(' | ');

  console.log(summaryLine);
  console.log(`Status: ${cleanIssue.status || issue.fields?.status?.name || 'Unknown'}`);
  console.log(
    `Reporter: ${cleanIssue.reporter || formatUser(issue.fields?.reporter, 'Unknown') || 'Unknown'}`
  );
  console.log(
    `Assignee: ${
      cleanIssue.assignee || formatUser(issue.fields?.assignee, 'Unassigned') || 'Unassigned'
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
