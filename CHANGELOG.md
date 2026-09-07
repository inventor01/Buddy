# Changelog

## 2026-09-07 — Response intelligence + bounded self-repair

### Root cause
- Buddy had strong specialist routing and evidence verification, but the final user response was still mostly specialist output followed by one synthesis pass.
- There was no dedicated decision-quality layer checking whether the answer actually resolved the user’s goal, chose/ranked when appropriate, identified the best next action, or surfaced the one uncertainty most likely to change the decision.
- Complex research could detect weak evidence only after the response was already formed; it did not get a bounded chance to repair one important public-web evidence gap before answering.
- Adding more prompt text alone would increase verbosity without reliably improving judgment.

### Permanent fix
- Added a shared Response Intelligence layer for complex research/decision requests.
- After normalized evidence is ready, Buddy now produces a concise evidence-bound `Bottom line`, `Best next move`, and `What could change this` overlay. It cannot browse or invent new facts during this judgment pass.
- Arbitrage intelligence explicitly treats verified opportunities above leads, never calls a lead buy-ready, never counts lead profit, and makes the best next move close the strongest missing evidence gap.
- Added a decision-quality gate scoring directness, evidence specificity, constraint coverage, ranking usefulness, actionability, uncertainty calibration, and unsupported-claim risk.
- For complexity 4–5 research only, a score below 80 may trigger at most ONE narrow public-web repair step when one concrete missing fact could materially change the recommendation.
- The repair instruction must name the exact evidence gap; broad `research more` loops are rejected.
- After a successful repair, Buddy re-synthesizes once using the original specialist evidence plus the targeted repair evidence.
- Simple reminders, connected-action chains, specialized arbitrage, and wholesale underwriting skip generic self-repair to control cost/latency and preserve their dedicated safety/math paths.
- Preview and saved/scheduled runs now use the same response-intelligence behavior.
- BuddyJob verification records whether a decision-quality review ran and whether the bounded repair pass completed.

### QA
- Production build and ESLint pass.
- Response-intelligence, orchestrator, shared runner, and preview bundles pass.
- Simple reminder test confirms the intelligence pass is skipped.
- Decision/research and arbitrage-lead tests confirm the intelligence pass is enabled.
- Low-quality (62/100) response with a narrow repair instruction triggers repair eligibility.
- High-quality (91/100) response cannot trigger an unnecessary repair even when the model asks for one.
- Bottom-line and next-move output contract passes.
- `git diff --check` passes.


## 2026-09-07 — Exact resale-comp product-page evidence

### Root cause
- Buddy enforced exact retailer product pages on the buy side, but the resale side could still accept a marketplace search/results URL as evidence for a quoted comp.
- The resale matcher explicitly allowed a highly specific eBay result page, which is not the same as the exact item/listing page whose price is being used.
- A generic marketplace label such as `Amazon/eBay` could also confuse host-specific URL validation.

### Permanent fix
- Added a shared exact resale-comp URL gate. Amazon comps must resolve to an exact `/dp/ASIN`, `/gp/product/ASIN`, or mobile `/gp/aw/d/ASIN` product page. eBay comps must resolve to an exact `/itm/` item/listing page.
- Amazon/eBay search pages, completed-listing search results, result grids, category pages, and marketplace homepages are discovery-only and can never certify a verified resale price.
- Added a dedicated resale-comp resolution pass. When a model finds a price from a marketplace search page, Buddy uses the exact SKU/UPC/model/variant to try again for the exact Amazon product page or eBay item page.
- If the exact comp page cannot be resolved, the resale price is removed from profit math and the item remains a Promising Lead with the buy side preserved.
- Final arbitrage normalization independently enforces the exact resale URL requirement so a generic marketplace URL cannot bypass the search pipeline.
- URL host is authoritative; a generic `Amazon/eBay` label no longer causes an exact eBay URL to be evaluated as Amazon evidence.
- Verified cards now label the resale button `Open exact resale comp`.

### QA
- Amazon search URL rejected; exact Amazon ASIN page accepted.
- eBay search/completed-results URL rejected; exact eBay `/itm/` page accepted.
- Exact eBay item page still passes when the marketplace label is `Amazon/eBay`.
- A valid Target product page paired with an eBay search-results comp cannot graduate to a verified opportunity; it cleanly downgrades to a one-sided lead with no resale URL or profit counted.
- Production build, ESLint, resale-evidence/arbitrage/arbitrage-search bundles, and `git diff --check` pass.


## 2026-09-07 — Exact retailer product-page evidence gate

### Root cause
- Arbitrage buy-side evidence validation only rejected a small set of generic URLs when the generic word appeared at the end of the path. It missed nested browse/category routes such as Target `/c/.../clearance/-/N-...` and retailer search routes such as Kroger `/q/...`.
- Those discovery pages could therefore be mislabeled as `Buy side verified` even though they did not prove the exact product, exact variant, or current item-level price.
- When a discovery pass learned a useful exact item/model/UPC from a generic page, there was no dedicated recovery step to resolve that candidate to the retailer's exact product-detail URL.

### Permanent fix
- Added a shared retailer evidence classifier with explicit product-detail URL rules for Target, Kroger, Meijer, TJ Maxx, Ollie's, Walmart, Best Buy, Home Depot, Lowe's, Walgreens, CVS, and Costco plus a conservative generic fallback.
- Target category/clearance routes and Kroger `/q/` search routes are now discovery-only and can never certify the buy side.
- The final arbitrage normalization boundary independently requires an exact retailer product-detail URL, so a weak URL cannot bypass the discovery filter and reach the UI as verified evidence.
- Resale evidence generic-page detection was expanded to reject browse/search/category/collection/clearance/home-style routes.
- Added an exact-product resolution pass: when Buddy discovers a specific item/model/UPC on a generic retailer page, it immediately searches again for the exact retailer product-detail page and only preserves the candidate when that exact page and current price are found.
- Resale matching can no longer overwrite a valid exact retailer product URL with a weaker generic URL returned by a later model pass.

### QA
- Exact reported Target clearance URL is rejected as buy-side evidence.
- Known Target `/p/.../-/A-...` product URL is accepted.
- Exact reported Kroger `/q/kitchen%2Bappliance` URL is rejected as buy-side evidence.
- Kroger `/p/<product>/<UPC>` product URL is accepted.
- Production build, ESLint, retail-evidence/arbitrage/arbitrage-search/shared-runner bundles, and `git diff --check` pass.


## 2026-09-07 — Remove arbitrage dead-end empty state

### Root cause
- Saved arbitrage runs silently caught failures from the dedicated retailer/coupon/resale pipeline and fell back to the generic web engine. That could produce the old “No specific arbitrage opportunity cleared...” message even when the specialized arbitrage pipeline had actually failed.
- If an Amazon/eBay cross-match batch failed, the exact retailer products already discovered in that batch were dropped because only fulfilled match batches were converted into findings.
- If all normal retailer-discovery passes returned zero exact product pages, the pipeline immediately ended instead of trying a simpler exact-product rescue query.
- The old empty-state copy hid which stage failed and made a source-access or pipeline problem look like proof that no arbitrage existed.

### Permanent fix
- Removed generic-web fallback for broad arbitrage. A dedicated arbitrage failure is now surfaced transparently and is never disguised as equivalent generic research.
- Failed Amazon/eBay match batches now preserve every exact retailer product as a one-sided retryable lead, including its direct buy page, verified current price, coupons/discounts, identifier, and missing resale-evidence reason.
- Added a bounded rescue discovery pass per named retailer when all normal high-value/deep-discount discovery passes return zero exact products.
- Added structured `search_stats`/verification reporting for retailer count, discovery passes, exact candidates, discount batches, resale-match batches completed/failed, verified deals, and preserved leads.
- Replaced the old opaque “No specific arbitrage opportunity cleared Buddy’s evidence and profit checks” copy everywhere. Empty runs now distinguish source-access/discovery limitations from actual verified zero-opportunity results.
- Preview runs now return a transparent arbitrage-pipeline error instead of silently masking a failure.

### QA
- Production build, ESLint, Buddy schema, arbitrage search/shared runner/run-now/scheduler/preview bundles, and `git diff --check` pass.
- Exact stale empty-state sentence is absent from the source tree.
- Simulated total Amazon/eBay match outage preserves exact Target/Meijer products as one-sided leads and reports failed match batches.
- Simulated zero normal discovery triggers the rescue pass and preserves a rescued exact Dyson product as a lead even when resale matching then fails.
- Leads remain excluded from verified-profit totals until resale evidence clears.


## 2026-09-06 — Coupon-aware arbitrage net-cost engine

### Root cause
- Arbitrage already had a single `discount_amount`, but it did not reliably distinguish a store markdown already reflected in the visible price from an additional coupon. That created a risk of double-counting sale/clearance savings.
- Coupon discovery was mixed into general product research rather than given its own verification pass, so digital coupons, loyalty offers, public promo codes, manufacturer coupons, and clip-to-account offers could be missed.
- Multiple offers could be combined without proving they stack with each other, and weak offers such as targeted coupons, future store cash, first-time-only promos, credit-card discounts, uncertain rebates, or expired offers could distort profit math.

### Permanent fix
- Added a shared server-side discount validator and ledger used by both discovery and final normalization.
- `buy_price` now explicitly means the CURRENT regular/sale/clearance price; `original_price`/`price_status` record the visible markdown separately so a sale is never subtracted twice.
- Added structured discount offers with kind, description, effective dollar amount, source URL, code, eligibility, current-price stacking, multi-offer stacking, exact-item applicability, and expiration.
- Added a dedicated coupon/discount enrichment pass before Amazon/eBay resale matching.
- The engine actively searches item-level digital coupons, free loyalty/member offers, public promo codes, manufacturer coupons, and clip-to-account savings.
- Net buy cost only subtracts offers that have source evidence, apply to the exact item, are valid/not expired, have acceptable eligibility, and explicitly stack with the current price.
- Personalized/targeted/account-specific, future reward/store cash, uncertain rebate, credit-card, employee, first-time-only, and unknown-eligibility offers are excluded from profit math.
- The single strongest verified offer is used by default. Multiple offers are combined only when all included offers explicitly say they stack with other offers.
- Added `profit_without_extra_discounts` and `coupon_dependent` so Buddy can show when a spread is only profitable because the coupon still applies.
- Verified and lead cards now show store markdowns separately from extra savings, list coupon/source/code/eligibility details, show net buy cost, and warn users to recheck coupon-dependent deals at checkout.
- Carried verified coupon details forward with unresolved leads so daily reruns do not forget a valid buy-side discount.

### QA
- Production build and ESLint pass.
- Buddy schema parses with the expanded discount ledger.
- Discount, arbitrage, arbitrage-search, runner, and orchestration bundles pass.
- Valid exact-item coupon is applied; expired, targeted, future-reward, and generic coupon-hub offers are rejected.
- Non-stackable offers are not combined; explicitly stackable offers combine correctly.
- A visible `$80 → $50` sale with a bogus `$30` discount field remains a `$50` net buy cost (no double-count).
- A coupon-dependent example correctly computes `$50 current price - $10 verified coupon = $40 net`, `$10` estimated profit, and flags the spread as coupon-dependent.
- `git diff --check` passes.

## 2026-09-06 — Target-aware actionable arbitrage ranking

### Root cause
- The dedicated arbitrage pipeline still gave every retailer one generic discovery pass, so low-dollar groceries and commodity clearance could consume the same search budget as LEGO, tools, electronics, appliances, or other categories that can realistically contribute to a $5K weekly target.
- Increasing discovery depth created a second problem: the fixed global candidate cap could let the first retailers monopolize the resale-matching pool, leaving later named retailers effectively unsearched.
- A resale-matching model could omit a difficult SKU entirely, causing an exact retail product to disappear rather than surviving as a one-sided lead.
- Every positive spread was ranked mostly by raw profit and could trigger a notification, even when the economics required hundreds of units or the spread was too small to be actionable.

### Permanent fix
- Added two target-aware discovery passes per retailer: a high-value exact-SKU pass and a deep-discount branded-goods pass.
- Explicitly prioritizes LEGO/sealed collectibles, gaming, electronics, tools/power tools, vacuums/small appliances, premium kitchen appliances, and branded beauty devices while deprioritizing ordinary groceries, low-dollar consumables, tiny discounts, bulky furniture, and generic apparel unless exceptional evidence exists.
- Candidate discovery now records category/brand and scores products before resale matching using identifier quality, branded/high-value category fit, current price, and supported discount depth.
- Candidate selection is balanced per retailer (up to six strongest each) before global ranking, preventing Target/Ollie's or any first-listed source from crowding Meijer/TJ Maxx/etc. out of the match budget.
- Increased the bounded resale cross-match pool to cover the balanced candidate set.
- Every exact retail candidate deterministically exits the resale pass as either a returned match or an explicit one-sided lead; model omission can no longer silently delete the product.
- Added deterministic verified-deal actionability scoring based on estimated profit per unit, ROI, match confidence, units-to-target math, and priority-category fit.
- Verified results are classified as `check_now`, `promising`, or `low_priority`; strong candidates rank first and low-priority positive spreads no longer trigger alerts by themselves.
- Result summaries now show an action queue count for CHECK NOW / promising / low priority.
- Verified cards display actionability score, target-unit math, demand evidence when genuinely visible, brand/category, and tier-specific next actions.
- Profit and ROI are attached at the dedicated pipeline layer as well as recomputed at the shared normalization boundary, so internal and UI consumers see a self-consistent deal object.

### QA
- Exact Target/Ollie's/Kroger/Meijer/TJ Maxx + `5k` prompt retains all five retailers and parses the target to $5,000.
- High-value LEGO candidate scores materially above a low-dollar grocery candidate.
- Strong $55/unit example classifies CHECK NOW with 88/100 actionability.
- $3/unit grocery spread remains visible but correctly classifies LOW PRIORITY.
- One-sided Dyson exact-product example survives as a lead.
- Portfolio summary counts tiers correctly and preserves deterministic profit/gap math.
- Production build, ESLint, Buddy schema parsing, arbitrage/search/shared runner/run-now/scheduler/preview bundles and `git diff --check` pass.


## 2026-09-06 — Actionable arbitrage retailer fan-out

### Root cause
- Even after adding strict evidence gates and carry-forward leads, arbitrage still depended on one broad research context to discover retailer products and prove Amazon/eBay resale evidence. Exact product discovery and exact resale matching are different search problems, so the verifier could legitimately end with zero actionable items.
- A broad candidate pool described inside one specialist output could be truncated before later stages saw enough exact SKUs/models.
- The user-facing result did not clearly tell the person what to do next when a deal or one-sided lead was found.

### Permanent fix
- Added a dedicated `runRetailArbitragePipeline` instead of routing broad arbitrage through the generic research engine first.
- The pipeline detects named retailers such as Target, Ollie's, Kroger, Meijer, TJ Maxx, Walmart, Best Buy, Home Depot, Lowe's and others; when none are named it uses a bounded default set of verifiable major U.S. retailers.
- Runs retailer-specific discovery in parallel. Each pass must return exact product/detail pages with current prices and preserves UPC/SKU/model/variant details when available.
- Deduplicates the candidate pool before a separate Amazon/eBay cross-match pass. Resale matching is identifier/variant-first and rejects mismatched variants and marketplace homepages.
- Carries recent unresolved buy-side leads back into the dedicated pipeline so the next run tries to finish yesterday's strongest candidates before starting from zero.
- Verified deals still require both evidence sides and positive server-recomputed spread. One-sided exact product evidence remains a lead and never counts toward the weekly target.
- Verified cards now include a clear `What to do now` sequence and direct `Check buy side` / `Check resale side` actions.
- Lead cards now include `Next verification` instructions and explicitly say the lead is not counted toward the target.
- Preview runs use the same dedicated arbitrage pipeline instead of a weaker generic one-shot search.
- Normal non-arbitrage Buddy requests retain their existing lightweight path; the multi-pass fan-out is arbitrage-specific.

### QA
- Exact prompt with Target, Ollie's, Kroger, Meijer, TJ Maxx and `5k` detects every retailer and parses the target to $5,000.
- Specific one-sided product pages survive as leads while the Ollie's generic current-flyer URL remains rejected.
- Production build, ESLint, Buddy schema parsing, dedicated arbitrage pipeline bundle, run-now, scheduled-run, preview, shared runner, orchestration bundles and `git diff --check` pass.
- Static gate confirms broad arbitrage routes through `runRetailArbitragePipeline` and both action-oriented UI states are present.


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
