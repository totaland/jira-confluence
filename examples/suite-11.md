---
project: CYMATE
type: Story
summary: Suite 11 — Sign Out Confirmation & NBA (olbdesk_signout_bottom)
assignee: M060883
priority: Medium
epic: CYMATE-6
labels:
  - regression
  - suite-11
  - nba
  - sign-out
acceptance: |
  - Given I am authenticated on the dashboard, when I click **Sign out**, then the Sign Out confirmation page loads successfully (logout URL present; no console errors).
  - Given the confirmation page is displayed, when the NBA **olbdesk_signout_bottom** loads, then:
      • Exactly **5** recommendation items are rendered.  
      • Exactly **1** item is flagged **Personalised** (the other **4** are non-personalised).  
      • All images/icons load (HTTP 200) and copy/typography match the approved screenshot.
  - Network validation (DevTools → Network → filter: `personalised-content`):
      • Exactly **1** request fires on the confirmation page.  
      • Response payload has **5** items with **one** clearly marked as personalised (`isPersonalised: true` or equivalent).  
      • No 4xx/5xx.
  - Special-character block renders **exactly** as:
      Special Chars - \$ \% \* ' " @ © ® 5
      (If your renderer mangles quotes, fallback is: `Special Chars - $ % * ' &quot; @ &copy; &reg; 5`)
  - Given the NBA is visible, when I follow its optional deep link and then return/cancel, the sign-out journey still completes without errors.
---

# Suite 11 — Sign Out Confirmation & NBA

**Covers original steps:** 37–38

## Scope
- Click **Sign out**
- Confirmation page shows NBA `olbdesk_signout_bottom`
- Validate NBA UI: **5** items total; **1** labelled **Personalised**
- Validate `personalised-content` network call (1 call; payload = 5 items; exactly 1 personalised)
- Validate special-character string exactly as shown above
- (Optional) Click an NBA deep link; ensure sign-out flow still completes

## Traceability
- Steps: 37, 38

## Step 37 — Sign out
**Action:** Click **Sign out** from the dashboard.  
**Expected:** Confirmation page loads (logout URL), no console errors.

## Step 38 — NBA & special characters
**Action:** Verify `olbdesk_signout_bottom` and special-character line.  
**Expected UI:**  
- Banner renders with **5** items; **1** is **Personalised**.  
- Special-character text equals: `Special Chars - $ % * ' " @ © ® 5`  
  (Markdown escape form in docs: `\$ \% \* ' " @ © ® 5`)

**Expected Network:**  
- Single `personalised-content` request; payload has 5 items with exactly 1 personalised; no 4xx/5xx.

**Optional deep link:** Following and returning doesn’t break sign-out flow.
