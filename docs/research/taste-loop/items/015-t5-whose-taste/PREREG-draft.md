# T5 S screen — registration draft (synthetic preparation only)

Not a registration, reader result, gate look or permission to run. BRIEF-A and REVIEW-fable supersede the
three-format choices in PLAN. Freeze this document's accepted successor, code closure, final eligibility and
cost quote before a real reader sees a case; review the protocol extension independently first.

- **Source/population.** Only tier A non-owner ratings from the loop's committed pack manifest (T0
  `2026-10-13T08:50:00Z`, pack SHA `ac1341f55c9b4d14e6514b91ee16dd9b5b2804ee86f1f821b3d40bc806b82bef`).
  At least 40 ratings. Owner is excluded from anchors/distractors. No B/C access, pulls or production changes.
- **Description.** S alone. `lab/t5/prod-manifest.json` pins 11 unmodified files at
  `6082cadcbed75c0d792d778b431ba8ece4389e9b`; the four portrait files equal the plan's earlier pin.
  `adapter.ts` freezes the template: adapter-authored headline sentence (not production UI copy);
  ordered production Side name; four attribute labels;
  share of loved titles to one decimal percent and mean to one decimal; up to four quoted `here` titles
  with early scores. Registry contains every named example key. No static film names occur in the template.
  Empty S has empty text and is coverage, excluded from primary. Snapshot uses all `in_pool && has_fingerprint`
  titles, missing attribute 255 as zero, population SD with zero-SD fallback 1. Poster eligibility uses the
  explicit frozen `has_poster` fact; unavailable backdrop is false. `unseen=[]` suppresses suggestions/edges;
  pure production person/clustering/naming runs unchanged. No guest sample. No L/SL or statement fits.
- **Split/removal.** Sort `(created_at, position, title_key)`, floor 70%, move left across gaps <2 seconds.
  Early `updated_at` must be known and strictly before the first later write. Bulk writes are never targets;
  retain later edits as flagged labels. Require nonempty early history and 15 unique named later titles.
  Remove named keys, transitive explicit alias keys, every same-series movie, then repeat to closure.
  Pack spellings share a title key; no inferred duplicate-work links. Audit any additional explicit alias
  evidence before registration. Never borrow history to fill a later list.
- **Triples/matching.** Up to four distinct distractor pairs, early means within 0.5, no rating-count caliper
  or count term in the cost. Minimize summed early-mean distance divided by 0.5; seeded hash breaks ties.
  Keep 15 rows sampled without replacement; hash-shuffle rows and distractor order. Cycle A/B/C for the answer
  within each member from a seeded offset (label counts differ by at most one, including four-triple members).
  All controls share lists/labels. Hash strings are implemented in `cases.py`, seed 20261013, pair identity
  included. Report fixed-position baselines but never stop on them. If member-weighted middle-mean or
  closest-printed-mean accuracy exceeds 40%, rebuild once: all three sampled means must be within range 0.2,
  and all three show shares within range 0.2. Rank pairs by total mean range plus show-share range, then hash.
  Require feasible low/middle/high anchor ranks (displayed mean, seeded ties); cycle those ranks from a seeded
  member offset, choosing at most four distinct pairs. Exclude anchors lacking any rank; report lost coverage.
  This balances rank counts to within one per member rather than centering the anchor. If either stopping
  baseline still exceeds 40% or no cases remain, stop before calls. Printed-mean baseline uses the
  share-weighted printed rounded Side means. No caliper widening or result-driven rematching.
- **Readers/controls.** Haiku `claude-haiku-5-5`, effort low; Astra `gpt-6-astra`, reasoning low; separate jobs,
  fresh empty directory per attempt. Exact prompt is `lab/t5/prompt.txt`; CLI/config choices in `broker.py`.
  Claude safe mode, no settings sources/MCP/tools/persistence; Codex no user config/rules/project docs, read-only,
  ephemeral, shell feature off; CODEX_HOME contains only copied auth.json and is deleted after each attempt.
  Codex item.completed/error before turn.started is recorded as a configuration warning; every other unknown
  item type fails closed as tool use. Haiku num_turns >1 is tool use; model IDs come from modelUsage keys.
  Pin CLI/provider versions at preflight.
  Temperature/seed unavailable. Same payload on one transport retry; completed malformed/abstaining answers wrong.
  A case means one frozen triple. Unresolved transport or tool use in any control voids that triple for that
  reader, counted once across controls. Exclude the union of voided triples across both readers from every
  primary/control column to preserve pairing; keep a member if at least one triple survives. More than 10%
  voided triples for either reader stops that reader job and makes the suite incomplete (exactly 10% is allowed).
  Missing records/hash failures still block completion. Reader jobs resume the same frozen suite: validate
  and skip every existing record.json, including malformed/terminal voids, without another call; ledger the
  resume, skipped records, new calls, attempts, costs and completion/interruption. Existing unfinished folders
  fail closed for inspection; never overwrite raw bytes or reset the retry allowance.
  No-description and numbers-only controls for every triple
  and reader; numbers-only retains only generated numeric fields in their lines, removing title digits too.
  Independently hash-permute each answer key once and replay original S answers, with no additional calls.
- **Statement scope.** Corrected statement code is separate from S and does not enter the primary. Without
  explicit complete-series ordering evidence its franchise contrast has no certified non-later controls;
  the franchise statement is inert, even when known later entries exist. Do not fetch completeness evidence.
- **Analysis/decision.** Equal-member mean of within-member triple accuracy; exact chance 1/3. Existing
  `stats.py`, 10,000 paired member draws, seed 20261013, same sorted members/draws for readers/controls.
  Report intervals, median, improved/tied/worse, paired S−numbers, observed SDE and final-n planning power.
  Descriptive sensitivity excludes whole triples containing any edited rating in any displayed list; never
  shorten lists, refill them, rematch or call readers again. Report retained members/triples and the same
  paired summaries for both readers. Fixed descriptive strata: usable early size <40, 40–79, 80–159, ≥160;
  anchor displayed-list show share 0, >0 and <0.5, ≥0.5. Each subset averages retained triples within member
  then members equally, using common draws for both readers/controls in that subset; empty subsets are n/a.
  These tables do not select a format or change the primary verdict. Small-n no-description/permuted screens
  are noisy and can block a pass; a nonpositive control is not proof of no leakage.
  Pooled-triple two-sided exact binomial p is descriptive under trial independence, never binding evidence;
  the binding inference uses members, not triples. S must reach 43⅓%, excess interval strictly above zero,
  and S−numbers interval above zero, separately in both readers. Positive no-description/permuted screens
  block a pass. Integrity failures invalidate. No format selection or Holm family. Null means insufficient
  evidence at the reported SDE; a pass remains unreplicated and cannot change the product.
- **Freeze/stop.** `source-manifest.json` covers S code/stubs/pinned files/prompt plus pack loader and stats;
  its hash, input/description/case hashes, final n, baselines and power precede calls. Artifacts private 700/600;
  ledger aggregates/hashes only. Immutable response bytes replay in a fresh process; no model reruns for verify.
  One frozen suite; no outcome-driven retries/rematching. Budget at most 24n planned calls (4 triples × 3 inputs
  × 2 readers), before transport retries. Real execution stays blocked until reviewed wrapper/ledger integration,
  registration parsing, title/alias audit, overlap sensitivity, exact provider availability, prompt token
  bounds and billed reasoning/output caps, ≤US$75 quote with ≤10% retry reserve, two-thread/4 GiB limits and
  30-minute deadline per resumable reader job are enforced by the reviewed wrapper.
  No authentication or price checks were made in this preparation.
