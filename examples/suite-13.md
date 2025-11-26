---
project: CYMATE
type: Story
summary: Suite 13 — Payment Confirmation Tile NBA
assignee: M060883
priority: Medium
epic: CYMATE-6
labels:
  - regression
  - suite-13
  - nba
  - payment-confirmation
acceptance: |
  - Given I can authenticate and reach the dashboard, when I launch Make a payment, supply approved fixture data, and submit, then the Payment confirmation screen loads successfully.
  - Given the Payment confirmation screen is displayed, when NBA olbdesk_paymentconfirm_mid renders, then it shows five recommendations with exactly one personalised (known tile misalignment remains acceptable).
  - Given the Payment confirmation NBA is shown, when I choose the Form URL link, then the Activate card destination opens and loads without errors blah blah.
---

# Suite 13 — Payment Confirmation Tile NBA

**Covers original steps:** 44–47

## Scope
- Sign in, dismiss splash, click **Make a payment**
- Fill form (use safe test data/fixtures), submit
- Confirmation page shows **tile NBA** `olbdesk_paymentconfirm_mid` (known misalignment OK)
- Click **Form URL** → lands on **Activate card**

## Assertions
- Tile visible; ends with `(5)`; **1** personalised
- Form URL navigation works and Activate card page loaded

## Traceability
- Steps: 44, 45, 46, 47
