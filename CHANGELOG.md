# Changelog

## 2026-09-06 — Consumer Buddy Rebrand + Flexible Handoffs

### Product direction
- Reframed the user experience around handing everyday things off to **Buddy** rather than exposing AI, agent, bot, workflow, or automation terminology.
- Expanded examples beyond coupons/reminders into finding, comparing, planning, watching, and recurring everyday work.
- Replaced technical/product-builder language with plain phrases such as “Hand it off,” “Keeping watch,” “Handled once,” and “Keeps doing this.”

### Root causes fixed
- **Every request behaved like a daily recurring search.** The planning engine now classifies requests as `once`, `watch`, or `repeat` and stores that behavior on each Buddy record.
- **One-time work never really finished.** One-time requests now move to `done` after the run completes and the UI shows a Done state instead of pause/resume controls.
- **Weekly requests could run every day.** Repeating requests that name a weekday now only become due on that weekday in the user’s timezone.
- **Watch requests could create noisy notifications even when nothing changed.** Results now include a `should_notify` decision; quiet checks can save their state without sending an unnecessary text/email.
- **Homepage positioning undersold the product as reminders/coupons.** The start and signed-in composer now lead with broad everyday outcomes and a single plain-English handoff box.

### QA
- Base44 function bundle errors encountered during editing were corrected before completion.
- `npm run build` passes in the Base44 sandbox.
- Consumer-facing source was checked for the words `agent`, `bot`, and `automation`; no intentional product copy uses those terms.

## 2026-09-06 — Consumer abilities + approval layer

### Root cause
Buddy could research and monitor, but it had no structured distinction between passive lookups and actions that change something outside the app. That meant there was no safe path to grow into email/calendar/task handoffs without risking silent writes or shared-account access.

### Permanent fix
- Added structured capability + action metadata to Buddy records.
- Added explicit approval states for all write actions.
- Added a backend executor that refuses to send email/create calendar events/create tasks unless the saved request is awaiting approval and the current owner explicitly approves it.
- Added per-person connector architecture using Base44 app-user OAuth connector IDs rather than shared app-scoped OAuth.
- Added Settings connection cards for Email, Calendar, and Tasks.
- Added a visible approval card in each handoff thread showing the exact recipient/content/date before anything happens.
- Kept consumer UI free of agent/bot/automation terminology.

### QA
- `npm run build` passes.
- Approval references verified across creation, UI, and backend execution paths.
- Consumer-facing source scan found no agent/bot/automation terminology in the main experience.
