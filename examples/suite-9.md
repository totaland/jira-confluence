---
project: CYMATE
type: Story
summary: Suite 9 — Preferences/Settings & NBA (olbdesk_settings_top)
assignee: M060883
priority: Medium
epic: CYMATE-6
labels:
  - regression
  - suite-9
  - nba
  - settings
acceptance: |
  - Given I am authenticated on the dashboard, when I open the **Notifications** menu and click **Notification settings**, then the **Preferences (Settings)** page loads successfully (URL updates; no console errors).
  - Given the Settings page is displayed, when the NBA **olbdesk_settings_top** loads at the top of the page, then the UI matches design and:
  - Special-character sanity check (top content strip): it renders **exactly** as  
      `Special Chars - $ % * ' " @ © ® 5`
      (Use this literal string as the oracle; do not escape characters on the page.)
  - Network validation (DevTools → Network → filter: `personalised-content`):
      • Exactly **1** request fires on the Settings page.  
      • The request/Target payload identifies the location as `olbdesk_settings_top` and the page as **Settings**.  
      • The response contains **5** offers/items with **one** clearly marked as personalised (e.g., `isPersonalised: true` or equivalent).  
      • No related 4xx/5xx errors.
  - Given the NBA is visible, when I click the **Savings Calculator** deep link and then use Back to return (or navigate via the browser/chevron), then I land back on **Settings** and the NBA still displays **5** items with **1 Personalised** (no UI or network errors).
  - Given a new login session begins, when I revisit **Settings**, then the NBA reloads with the **same** badge count `(5)` and **exactly 1** personalised recommendation.
---

# Suite 9 — Preferences/Settings & NBA

**Covers original steps:** 31–33, 39–41

## Scope
- From the **Notifications** dropdown open **Notification settings** (Preferences).
- Validate Settings NBA `olbdesk_settings_top` shows **5** items with **1** labelled **Personalised** and a visible count **(5)**.
- Validate the **personalised-content** network call (single call; payload = 5 items; exactly 1 personalised; location = `olbdesk_settings_top`).
- Validate the special-character strip: `Special Chars - $ % * ' " @ © ® 5`.
- Follow the **Savings Calculator** deep link; return to Settings; then click the Westpac logo to navigate back to the dashboard.
- Re-authenticate and revisit Settings to confirm the NBA state persists.

## Assertions
- **Notification settings** entry is present and opens the **Preferences** page.
- `olbdesk_settings_top` banner renders with design-accurate UI.
- **5** items displayed; **1** item labelled **Personalised**; count shows **(5)**.
- DevTools Network (filter: `personalised-content`): **1** request; payload = 5 items; 1 personalised; status 200; location/page metadata matches Settings.
- **Savings Calculator** page loads; returning preserves the NBA state and does not produce console/network errors.
- After re-login, Settings reloads with the same NBA state (5 items / 1 personalised).

## Traceability
- Steps: 31, 32, 33, 39, 40, 41
