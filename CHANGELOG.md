# Changelog

## 2026-09-06 — Arbitrage discovery pipeline + carry-forward leads

### Root cause
- The verified-arbitrage evidence gate was intentionally strict, but the discovery engine had only two outcomes: fully verified or discarded. Exact retailer pricing and exact resale evidence frequently become available in separate passes, so useful one-sided candidates were thrown away and the user saw an empty result.
- Arbitrage specialist outputs were truncated at normal-task limits (roughly 4.5K–9K characters and 12 URLs) between research stages, which could cut most of a 25–40 product candidate pool before resale matching and final verification.
- Every scheduled run effectively started from zero; unresolved products from yesterday were not preserved as a verification queue.

### Permanent fix
- Added a third state, `arbitrage_lead`, for specific products where exactly one side has direct non-generic price evidence. Leads include exact identifiers when available, the verified side, missing evidence, confidence, and why the product is worth another verification pass.
- Leads never count toward the $5K target, never receive profit/ROI numbers, and generic flyers/deals hubs are still rejected.
- Added a dedicated amber “Promising lead · still verifying” card and a result state that does not falsely say the request is handled.
- The arbitrage planner now builds a 25–40 candidate pool, preserves UPC/SKU/model/variant details, cross-matches roughly the strongest 15, and keeps one-sided candidates instead of discarding them.
- Increased intermediate arbitrage-only context/output/evidence limits to preserve up to 30 source URLs and substantially more candidate detail between specialist stages; normal Buddy requests retain their previous limits.
- Added top-level unresolved arbitrage lead storage on Buddy records. Daily runs save the latest one-sided candidates and, for up to seven days, attempt to finish verifying them before starting a new broad scan.
- Generic fallback research also consumes saved prior leads, so the pipeline remains cumulative even if enhanced orchestration is unavailable.
- Result summaries now separately report verified estimated one-unit profit and the number of promising leads still being checked.

### QA
- One-sided exact product lead survives while generic Ollie’s flyer lead is rejected.
- Verified opportunity math still recomputes correctly server-side.
- Lead candidates do not contribute to the $5K target or verified-opportunity count.
- Existing `5k` target parsing remains correct.
- Buddy schema parses with the new persisted lead queue.
- Production build, ESLint, shared runner/orchestrator/preview bundles, `git diff --check`, and targeted lead-pipeline regression tests pass.


## 2026-09-06 — Weekly arbitrage target portfolio behavior

### Root cause
- A prompt such as `Everyday search and find arbritage opportunities for a minimum of 5k that i can make this week` did not necessarily enter the dedicated arbitrage path because the detector expected named stores/marketplaces.
- The `$5K` goal could be interpreted like a minimum profit filter on each result instead of a combined weekly portfolio target, causing useful smaller positive-spread opportunities to be discarded.
- When stores/marketplaces were omitted, Buddy could ask another optional narrowing question instead of choosing sensible defaults.
- The generic 5-result research path was too shallow for a weekly portfolio goal.

### Permanent fix
- Any clear `find/search + arbitrage/resale/flip` request now activates the arbitrage workflow, including common `arbritage`/`arbitage` misspellings.
- Broad arbitrage no longer requires the user to name Amazon/eBay or specific retailers.
- When sources are unspecified, Buddy defaults to broad current U.S. retail/online sourcing with Amazon/eBay resale evidence rather than asking for stores, marketplaces, categories, or items.
- Added profit-target parsing for `$5K`, `5k`, and similar goal language.
- A weekly/make/earn target is explicitly treated as the AGGREGATE target across multiple opportunities unless the person explicitly says `each`, `per item`, or `per deal`.
- Added a deterministic arbitrage orchestration chain: retail scan → exact resale cross-match → deterministic profit math → verification.
- Broad arbitrage runs can retain up to 12 verified positive-spread opportunities instead of only five.
- Partial progress is preserved: Buddy reports the estimated one-unit potential found on the current run and the remaining gap to the weekly target instead of returning nothing because the target has not been reached yet.
- Empty recurring runs preserve the target and tell the user Buddy will keep scanning on the next scheduled run rather than suggesting unnecessary narrowing.
- Profit progress is explicitly labeled as opportunity math, not guaranteed profit or confirmed inventory quantity.

### QA
- Exact user sentence with `arbritage` is recognized as arbitrage and broad discovery.
- `5k` parses deterministically to `$5,000`.
- Product-category, store, and marketplace clarification variants are suppressed for the exact prompt.
- Valid opportunities totaling less than the target remain valid; unit test produced `$190` potential and correctly reported a `$4,810` gap instead of rejecting the batch.
- Net buy cost remains independently recomputed rather than trusting model math.
- Production build, ESLint, all affected backend/shared bundles, and `git diff --check` pass.


## 2026-09-06 — Arbitrage evidence + profit quality gate

### Root cause
- Retail-arbitrage runs used the generic findings contract, so a sentence such as “could not be verified” linked to a store flyer could still render like a useful result.
- Generic flyer/deals pages were valid URLs but were not strong enough evidence for a specific buy/resale spread.
- Arbitrage math and `why_fit` could be model-authored, which allowed weak personalization and unverified calculations to look authoritative.

### Permanent fix
- Added a dedicated structured arbitrage result contract: item, retailer, marketplace, store price, verified discount, net buy cost, resale price, estimated fees, direct buy URL, direct resale evidence URL, and caveat.
- Added a pure server-side arbitrage gate that rejects flyer/deals/clearance hubs, missing evidence URLs, missing prices, and non-positive spreads.
- Buddy independently recomputes net buy cost, estimated profit, and ROI from the supported inputs rather than trusting model arithmetic.
- Broad arbitrage runs now discard every generic finding that does not pass the structured evidence gate.
- If nothing passes, Buddy returns a neutral “no specific opportunity cleared the evidence and profit checks today” state instead of presenting a failure sentence as a recommendation.
- Arbitrage `why_fit` is suppressed so matching the user’s requested stores/ZIP is not mislabeled as personalization.
- Added an ArbitrageCard showing buy cost, resale price, fees, estimated profit/ROI, verified discount, and separate direct links for store evidence and resale evidence.
- Updated preview, orchestration, saved-message schema, and chat rendering to preserve the structured arbitrage result end-to-end.

### QA
- Exact Ollie’s `/pages/current-flyer` pattern is rejected as generic evidence.
- A flyer-backed fake opportunity is rejected even when it contains positive-looking numbers.
- A properly structured Target → eBay example with direct evidence survives.
- Net buy cost, profit, and ROI are independently recomputed and verified by unit test.
- Negative-spread candidates are rejected.
- Production build, ESLint, affected backend/shared bundles, Buddy schema parsing, and `git diff --check` pass.


## 2026-09-06 — Stop repeated optional clarification loops

### Root cause
- Buddy treated broad discovery as incomplete input. A request to scan named retailers and resale marketplaces for arbitrage could be interpreted as requiring a product category, even though “scan broadly and rank the best opportunities” is itself a complete instruction.
- The same optional question could be generated independently by the initial planner and later by the findings/research runner, so suppressing only one layer would not permanently stop the loop.
- Existing recurring handoffs could remain stuck because `runDueBuddies` skipped every record with `open_question`, including stale optional category questions.
- Common misspellings such as `arbritage` were not guaranteed to hit a deterministic arbitrage rule.

### Permanent fix
- Added shared clarification rules that recognize broad retail-arbitrage/resale discovery, including common arbitrage misspellings.
- Product-category/specific-item questions are now suppressed only when the original request is intentionally broad and already names the source/resale ecosystem.
- Initial planning explicitly treats broad discovery as valid and preserves all named stores/marketplaces.
- Findings and preview paths use the same suppression rule, preventing a later model call from reintroducing the question.
- Orchestration now plans broad arbitrage as research across the named stores → resale comparison → verified coupon/discount math → ranking → verification rather than narrowing to one category.
- Existing saved handoffs automatically clear stale optional scope questions on manual or scheduled execution, while genuinely required questions remain blocking.
- Retail-arbitrage findings are instructed to include only verifiable coupons/discounts, use direct source links, and label unknown fees/shipping/tax rather than inventing them.

### QA
- Exact user request with `arbritage` is recognized as broad arbitrage.
- Five category/item question variants are suppressed.
- Required flight-origin clarification remains intact.
- Production build and ESLint pass.
- Backend/shared bundles pass for planner, preview, run-now, scheduler, shared runner, orchestrator, and clarification rules.
- `git diff --check` passes.


## 2026-09-06 — Consumer-grade trust + Buddy category differentiation

### Root causes found
- **Buddy’s strongest behavior was hidden behind a chat-like first impression.** The landing and plan review did not make the core handoff model obvious: the user gives an outcome, Buddy owns the dependent work, and the user returns only for a missing detail or consequential approval.
- **Receipts and escalations were not strong trust artifacts.** Owner-side create/update RLS meant client code could theoretically forge records that the UI presented as system-generated history.
- **Buddy displayed invented time-saved estimates.** Receipts assigned fixed 8/10-minute values that were not measured.
- **Navigation leaked users out of the product.** `/start` was referenced but missing, Settings and post-payment links labeled as returning to the workspace pointed to `/`, authenticated logo clicks opened the public landing page, and normal login defaulted to `/` instead of the workspace.
- **Settings exposed implementation complexity.** Niche wholesale/ad controls and specialist readiness made the default consumer experience feel like a configurable agent console.
- **Connection cards showed app readiness, not the current person’s connection state.** Already-connected users could still see a generic Connect state.
- **One-click deletion and generic template branding weakened product trust.** Handoffs deleted immediately; the 404, favicon, and missing web manifest still exposed platform/template residue.
- **Several visible labels still described Buddy as notes rather than delegated work.** This weakened the category position.

### Permanent fixes
- Repositioned the first screen around **“Hand off the outcome, not the steps”** and added a visible `Find → Review → Prepare → Ask you → Finish` model.
- Added a handoff contract to plan review: **Buddy owns** the outcome and **You’re needed for** only the missing detail/approval, or nothing else right now.
- Added a complex carry-through example that demonstrates research → ranking → outreach preparation → approval rather than another one-shot answer.
- Made BuddyReceipt and BuddyEscalation create/update server-controlled while retaining owner read/delete access.
- Removed all displayed time-saved claims and neutralized the legacy receipt field until a measured source exists.
- Added `/start`, fixed workspace navigation, made normal auth return to `/notes`, and corrected post-payment links.
- Added Buddy-branded favicon, metadata, install manifest, standalone launch behavior, and a Buddy-native 404.
- Collapsed wholesale and Meta controls behind Advanced options; specialist readiness remains admin-only.
- `connectionSetup` now checks the current app-user connection and Settings displays `Connected` instead of only environment readiness.
- Added a two-step deletion confirmation for handoffs.
- Replaced visible note-centric copy with handoff/things/Buddy language in core surfaces.
- Made manual rerun copy context-aware: search-like handoffs say `Run this search now`; other web handoffs say `Run this again now`.
- Removed overbroad photo copy and now truthfully says the exact image is used as context.

### Market-position check
- Current competitors increasingly offer recurring tasks, memory/context, approvals, integrations, and autonomous execution. Buddy therefore treats those as table stakes, not the USP.
- The protected product thesis is the interaction model: no agent builder, trigger/action editor, skill/model selection, or workflow assembly for ordinary users; one outcome becomes a managed, evidence-aware handoff.

### QA / release notes
- Final production build and ESLint pass.
- Buddy, BuddyJob, BuddyReceipt, BuddyEscalation, PhoneIdentity, and DelegationPolicy schemas parse successfully.
- Backend bundles pass for planning, creation, run-now, connected actions, scheduled runs, preview, connection state, shared runner, orchestration, linked-chat resolution, task chains, and receipts.
- Browser/PWA assets, workspace routes, auth-return behavior, handoff-contract UI, server-owned trust records, delete confirmation, and consumer-language regression checks pass.
- `git diff --check` passes.
- Base44 connector catalog reported Gmail, Google Calendar, and Google Tasks as not connected at the app level during this pass; code is release-gated, but live connected-action E2E should not be claimed until OAuth configuration is connected and exercised.

## 2026-09-06 — Response error debugging

### Root causes found
- Anonymous `previewBuddyRun` was limited to 6 requests/minute and 30/day, but the Start page discarded the actual 429 response with `catch (_)`, making rate limits look like broken Buddy answers.
- The server-side three-free-handoff limit correctly returned `403 { upgrade_required: true }`, but the existing PaymentSheet was not mounted in Start or Home, so users saw a generic failure instead of the upgrade flow.
- Signed-in thread replies also replaced backend/provider errors with a generic “That run didn't finish” toast, hiding missing connections, rate limits, and real provider errors behind one message.

### Permanent fixes
- Raised anonymous try-it-now preview allowance to 12/minute and 100/day while keeping a bounded abuse/cost control.
- Added structured `RATE_LIMITED` responses with `retry_after` on preview, run-now, and handoff creation paths.
- Start now surfaces the real backend error instead of silently swallowing preview failures.
- Home thread replies now surface the backend-provided reason.
- Mounted the existing Buddy Pro PaymentSheet in both Start and Home and route `upgrade_required` responses into it while preserving the current prompt/plan.
- Hardened preview error serialization so thrown non-Error values still return a useful message.

### Verification
- Direct call to the currently published anonymous planner returned HTTP 200.
- Direct call to the currently published anonymous plumber-comparison preview returned HTTP 200 with five findings and source URLs.
- Production build passes.
- ESLint passes.
- Backend bundles pass for preview, run-now, create-record, and planning functions.
- Response-error regression markers and `git diff --check` pass.


## 2026-09-06 — Connected chats + multi-step handoff QA hardening

### Root causes found during QA
- **Email reads could be misclassified as sends.** The word `email` itself was included in the write-intent regex, so a request such as “check my email” could enter the send path.
- **A dependent step could continue after an earlier dependency failed or was still waiting for approval.** The orchestrator carried prior output forward but did not require every declared dependency to have actually completed.
- **The job audit trail could say completed while an outside action was still waiting for approval.** Prepared connected-action placeholders were being marked as completed even though nothing had been sent or changed yet.

### Permanent fixes
- Split email read intent from email send intent. Reading/reviewing/checking an inbox cannot become `email_send` merely because the request contains the word “email.”
- Enforced dependency completion before a downstream chain step can execute. Failed prerequisites block dependents; approval-gated prerequisites leave dependents pending.
- Approval-gated connected steps now use `waiting_approval`, and the overall BuddyJob uses `needs_approval` until the real action succeeds.
- After an approved connected action succeeds, the latest BuddyJob is advanced to completed/waiting state so the audit trail matches the real outside action.
- The thread UI now distinguishes Verified, Needs approval, Waiting, In progress, and Needs another way.
- @-linked context remains owner-scoped and older exact references are resolved directly rather than only from the newest 100 handoffs.
- Gmail response chains preserve thread ID plus Message-ID/References headers; background scheduler skips reply-wait states that require per-user OAuth context.

### QA
- Production build passes.
- ESLint passes.
- Buddy and BuddyJob schemas parse successfully.
- Backend bundles pass for planning, creation, run-now, connected actions, scheduled runs, preview, shared runner, orchestration, linked-chat resolution, and task-chain helpers.
- Unit checks pass for @ parsing/deduplication, older-chat lookup, cross-user reference rejection, owner-scoped loading, dependency preservation, and mandatory approval on send steps.
- Regression guards confirm failed dependencies cannot continue, approval states are not falsely marked complete, Gmail threading headers are present, and reply-wait chains are excluded from background execution.
- `git diff --check` passes.


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
