# Changelog

## 2026-09-06 — Longer requests and better result links

### Root causes
- Buddy had separate 300-character limits in the UI, planning, preview, and save paths, so longer requests could be cut before execution.
- Follow-up messages had a smaller limit than the new request size.
- Result URLs were checked for validity, but generic homepages could still appear instead of the specific result page.

### Permanent fixes
- Raised Buddy request length to 8,000 characters across compose, plan, preview, save, edit, and follow-up paths.
- Added character counters and a multiline follow-up composer.
- Result handling now removes bare homepages and asks research paths to return the most specific verified article, product, listing, provider, route/search, or booking page available.
- Product and property destinations use the same shared URL cleanup before they are shown.

### QA
- Production build passes.
- ESLint completes with no errors.
- Regression scan found no remaining 300-character Buddy note limit or 500-character follow-up limit in active handoff paths.

## 2026-09-06 — Intelligence Gate + Performance-Based Specialist Routing

### Root causes
- **Specialist selection was still mostly hardcoded.** Buddy preferred a configured provider by fixed order rather than learning which worker actually performs best for a particular capability.
- **There was no repeatable intelligence release gate.** Complex-request quality was judged manually, so regressions in decomposition, verification, safety, or evidence quality could ship unnoticed.
- **Provider outcomes were not aggregated into routing decisions.** BuddyJob stored the execution trail, but success/failure/latency/fallback history did not improve future selection.

### Permanent fixes
- Added admin-only `ProviderPerformance` records keyed by provider + capability with run count, success/failure, verified successes, fallbacks, average latency, and a smoothed performance score.
- Added performance-aware provider ranking with conservative priors and sample-size smoothing so a provider cannot become the permanent winner or loser from one run.
- Every specialist attempt now records success/failure, latency, and fallback usage without being allowed to break the user's request if metrics storage fails.
- Successful final verification feeds back into the provider score.
- BuddyJob steps now retain latency and attempted-provider history for auditability.
- Added a 25-case Intelligence Gate spanning real estate, travel, local services, shopping, research, planning, recurring work, ambiguity, and approval-sensitive requests.
- Added structural scoring for orchestration, required specialist step types, bounded decomposition, verification, and approval-preserving consequential work.
- Added an optional live gate that executes a controlled subset, judges results against the actual specialist evidence, and treats unsupported critical facts as automatic failures.
- Added admin-only Settings controls for the latest pass rate, case count, critical-fact failures, the full structural gate, and a five-case live sample.
- Release target is encoded as >=90% passing with zero unsupported critical facts.

### QA
- `npm run build` passes.
- `npm run lint` passes.
- Backend bundles pass for run-now, scheduled runs, and the Intelligence Gate.
- Static release checks confirm exactly 25 gate cases and the adaptive ranking/recording/verification hooks.


## 2026-09-06 — Buddy Orchestration Engine + Confirmed Phone Delivery

### Root causes
- **Complex requests were still treated as one model call.** Even when Buddy had specialized property data, hard requests did not have a general decomposition/router/verifier layer, so research, browser checks, domain data, calculations, and verification could not be assigned independently.
- **One provider could become a single point of failure.** There was no internal job record or fallback accounting when an outside specialist failed.
- **Phone numbers could be saved without proof of ownership.** The old Settings/landing flow wrote `sms_phone` directly, so there was no server-enforced confirmation gate before scheduled text delivery.

### Permanent fixes
- Added private `BuddyJob` records with bounded specialist steps, status, provider routing, evidence URLs, confidence, fallback count, and verification summary.
- Added a complexity router so simple requests stay on the fast path while multi-step requests enter the orchestration engine automatically.
- Added provider adapters for OpenAI Responses web research, Browserbase page fetching, RentCast property underwriting, plus Buddy-native research/reasoning fallbacks.
- Added final verification/synthesis that only uses specialist evidence and keeps consequential actions inside the existing approval path.
- Wholesale requests now orchestrate live property underwriting, top-listing page verification when a browser specialist is available, and deterministic recomputation of the wholesale formula.
- Added a consumer-facing “How Buddy handled this” trail without exposing vendor/model jargon.
- Added private `PhoneIdentity` records and a server-side `phoneVerification` flow: 6-digit OTP, hashed code storage, 10-minute expiry, 60-second resend cooldown, five-attempt cap, and rate limits.
- Restricted the OTP hash from client reads.
- Updated run-now and scheduled SMS delivery to resolve only a verified `PhoneIdentity`; raw `User.sms_phone` is no longer trusted for delivery.
- Updated Settings and landing/sign-in flows to use Send code → Confirm number. Pending numbers remain unusable for texts until confirmed.

### QA
- `npm run build` passes.
- `npm run lint` passes.
- Backend bundles pass for run-now, scheduled runs, phone verification, connection readiness, connected actions, and preview.
- Regression scan confirms the old direct raw-phone save/delivery paths are removed from active frontend and runner code.

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
