# CLI Skills (for LLM agents)

All commands assume Node ≥14.13 with `.env` containing Jira/Confluence credentials.

- **Skill: install-deps**
  ```bash
  npm install
  ```

- **Skill: create-jira-issue-from-markdown**
  ```bash
  node cli.js jira-create --from-markdown examples/suite-11.md
  ```
  - Acceptance bullets formatted `- Given …, when …, then …` autoconvert to a Jira table.

- **Skill: update-jira-issue-from-markdown**
  ```bash
  node cli.js jira-update CYMATE-20 --from-markdown examples/suite-11.md
  ```
  - Append `--acceptance-field <customfield_id>` if the acceptance field differs.

- **Skill: get-jira-issue-json**
  ```bash
  node cli.js jira-get CYMATE-20 --json
  ```

- **Skill: read-confluence-page**
  ```bash
  node cli.js confluence-read --id 12345
  ```

- **Skill: update-confluence-from-file**
  ```bash
  node cli.js confluence-update --id 12345 --body-file body.storage
  ```