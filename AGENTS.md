# CLI Skills (for LLM agents)

All commands assume Node ≥14.13 with `.env` containing Jira/Confluence credentials.

## Prerequisites

**Option 1: Build first, then use Node**
```bash
npm install
npm run build
node dist/cli.js <command>
```

**Option 2: Use Bun to run TypeScript directly**
```bash
bun cli.ts <command>
```

---

- **Skill: install-deps**
  ```bash
  npm install
  ```

- **Skill: create-jira-issue-from-json**
  ```bash
  node dist/cli.js jira-create --from-json examples/issue.json
  ```
  - Acceptance bullets formatted `- Given …, when …, then …` autoconvert to a Jira table.

- **Skill: update-jira-issue-from-json**
  ```bash
  node dist/cli.js jira-update CYMATE-20 --from-json examples/update.json
  ```
  - Append `--acceptance-field <customfield_id>` if the acceptance field differs.

- **Skill: get-jira-issue-json**
  ```bash
  node dist/cli.js jira-get CYMATE-20 --json
  ```

- **Skill: read-confluence-page**
  ```bash
  node dist/cli.js confluence-read --id 12345
  ```

- **Skill: update-confluence-from-file**
  ```bash
  node dist/cli.js confluence-update --id 12345 --body-file body.storage
  ```

- **Skill: search-confluence-pages**
  ```bash
  # Simple text search
  node dist/cli.js confluence-search --text "vulnerability"

  # Search within a specific space
  node dist/cli.js confluence-search --text "auth" --space DOCS --limit 20

  # Search with CQL (Confluence Query Language)
  node dist/cli.js confluence-search --cql 'type=page AND label="api"'

  # Search AND read first result in one command
  node dist/cli.js confluence-search --text "Jira Confluence CLI Tool" --space CTENG --read
  ```

- **Skill: search-and-read-confluence-page**
  When user provides a Confluence URL or asks to find and read a page:
  1. Extract space key and title from URL (e.g., `/display/CTENG/My+Page` → space=CTENG, title="My Page")
  2. Run: `node dist/cli.js confluence-search --text "<title>" --space <SPACE> --read`

  Example:
  ```bash
  # URL: https://confluence.srv.westpac.com.au/display/CTENG/Jira+Confluence+CLI+Tool
  node dist/cli.js confluence-search --text "Jira Confluence CLI Tool" --space CTENG --read
  ```

- **Skill: search-jira-issues**
  ```bash
  # Search with JQL
  node dist/cli.js jira-search --jql "assignee = currentUser() ORDER BY updated DESC"

  # Simple text search
  node dist/cli.js jira-search --text "authentication" --limit 10
  ```

- **Skill: transition-jira-issue**
  ```bash
  node dist/cli.js jira-transition CYMATE-20 --status "Done"
  ```
  - Status names are case-insensitive (e.g., "done", "Done", "DONE" all work).