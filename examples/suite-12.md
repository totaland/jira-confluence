---
project: CYMATE
type: Story
summary: Suite 12 — Transfer Funds Confirmation Tile NBA
assignee: M060883
priority: Medium
epic: CYMATE-6
labels:
  - regression
  - suite-12
  - nba
  - transfer-funds
acceptance: |
  - Given I am on the dashboard, when I submit a transfer via Transfer funds, then the Transfer Funds confirmation screen loads successfully.
  - Given the Transfer Funds confirmation screen is displayed, when NBA olbdesk_transferfundconfirm_tile renders, then it shows five recommendations with exactly one personalised (known tile misalignment remains acceptable).
  - Given the Transfer Funds confirmation NBA is present, when I select the Form URL link, then the Activate your physical card screen opens in the expected context.
---

# Suite 12 — Transfer Funds Confirmation Tile NBA

**Covers original steps:** 41–43

## Scope
- From dashboard, click **Transfer funds**
- Confirmation page shows **tile NBA** `olbdesk_transferfundconfirm_tile` (known misalignment OK)
- Click **Form URL** → lands on **Activate your physical card**

## Assertions
- Tile visible; ends with `(5)`; **1** personalised
- Form URL navigation works and target page loaded

## Traceability
- Steps: 41, 42, 43
