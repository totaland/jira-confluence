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


  # Read Word Document (.docx) Skill

Extract text content from Microsoft Word (.docx) files.

## When to use this skill

- When the user asks to read, extract, or analyze a `.docx` file
- When the user provides a path to a Word document

## How to read a .docx file

Word documents are ZIP archives containing XML. Use this command to extract the text:

```bash
unzip -p "<path-to-file.docx>" word/document.xml | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' '
```

### Explanation
- `unzip -p` extracts to stdout without creating files
- `word/document.xml` contains the main document content
- `sed 's/<[^>]*>//g'` strips XML tags
- `tr -s '[:space:]' ' '` normalizes whitespace

## For structured output (preserving some line breaks)

```bash
unzip -p "<path-to-file.docx>" word/document.xml | sed 's/<\/w:p>/\n/g' | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' '
```

This preserves paragraph breaks by converting `</w:p>` tags to newlines before stripping XML.

## Limitations

- Images and embedded objects are not extracted (they are in `word/media/`)
- Complex formatting (tables, headers, footers) may not render perfectly
- For tables, consider extracting `word/document.xml` and parsing the `<w:tbl>` elements separately

## Example

```bash
# Read full document
unzip -p "/path/to/document.docx" word/document.xml | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' '

# Preview first 500 characters
unzip -p "/path/to/document.docx" word/document.xml | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' ' | head -c 500
```
## For tables

To extract and format tables from a Word document, you can use the following command:

```bash
unzip -p "<path-to-file.docx>" word/document.xml | grep -A 10 "<w:tbl>" | sed 's/<[^>]*>//g' | tr -s '[:space:]' ' '
```

This command:
1. Extracts the document.xml file from the .docx archive
2. Uses grep to find table elements (`<w:tbl>`) and the next 10 lines
3. Strips XML tags
4. Normalizes whitespace

For more complex table processing, you might want to use a dedicated XML parser or a library like `python-docx` in Python.