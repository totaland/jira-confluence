---
project: CYMATE
type: Story
summary: Suite 10 — Overseas Confirmation & NBA
assignee: M060883
priority: Medium
epic: CYMATE-6
labels:
  - regression
  - suite-10
  - nba
  - overseas-confirmation
acceptance: |
  - Given I am authenticated on the dashboard, when I open Services and select the Overseas Confirmation entry, then the Overseas Confirmation view loads successfully.
  - Given the Overseas Confirmation view is open, when NBA olbdesk_overseasconfirm_mid renders, then it displays five recommendations with one marked as personalised.
  - Given the NBA card is selected, when I launch the Savings Calculator and navigate back to Overseas Confirmation and then the dashboard via the Westpac logo, then the session stays active and the NBA reloads with the same recommendations.
---

# Suite 10 — Overseas Confirmation & NBA

**Covers original steps:** 34–36

## Scope
- From Services dropdown choose **Services** option that shows `olbdesk_overseasconfirm_mid` NBA
- Validate UI + `(5)`; **1** personalised
- Click NBA → Savings Calculator; back to Confirmation; then Westpac logo to dashboard

## Traceability
- Steps: 34, 35, 36
