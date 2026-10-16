# T5 S screen: registration (October 16, 2026)

Registered before any reader saw a case. It is `PREREG-draft.md` (reviewed by Fable in `REVIEW-fable-harness.md`,
fixes in `REPORT-fixes.md`) plus the two amendments that follow, made on build baselines before any reader call.
Where the draft says execution stays blocked, this file is the registration that unblocks it.

## Amendments before any reader call

- **A2, media-type baseline.** A new stopping baseline: pick the list whose show share is closest to the show share
  of the titles the description names. On build 1 (19 members, 73 triples) it scored 43.4% member-weighted, over
  the 40% line. The registered rematch kept 0 members; a show-share caliper alone kept 12–14 members with the
  baseline still at 49%.
- **A1, later lists hold movies only** (`lab/t5/cases.py`, `LIST_MEDIA`). Matching movies against shows is not the
  words of a Side, and the numbers-only control strips titles, so it could never catch this shortcut. Descriptions
  are unchanged; they may still name shows. Cost: the claim narrows to members with 15+ later movie ratings
  (19 to 12 primary members); show-heavy members drop out.
- **Consequences of A1** (Fable check, go): with single-type lists the media-type baseline ties on every list, so it is
  reported but never stops a run (its 35.4% is position noise). The registered show-share strata (anchor list show
  share 0, >0 and <0.5, ≥0.5) are degenerate and are struck: not reported. Middle mean at 39.6% is under the 40%
  line and is not moved; the paid numbers-only control, which sees the same numbers, is the binding guard.
- **What a null means here:** with 12 members and 9% power at the +10-point floor, a null says nothing about
  absence of personal signal. Only a pass that clears the numbers-only control in both readers means anything.

- **Incident, October 16, 2026, 06:10 UTC (after commit `04f515b2`):** the first registered read job ran the
  harness's fake reader, because `run.py` passed the synthetic reader unconditionally. 141 fake answers ("A" every
  time), no model call, not scored. Folder `run-20261016e` is kept as the record and not used. Fixed in `run.py`
  (fake reader only in synthetic runs; a real run refuses fake records at read and score time), two tests added,
  cases rebuilt unchanged (same `cases_digest`) into `run-20261016f`. Only the source digest changes.

## Frozen run

| Item | Value |
|---|---|
| Run folder | `~/goodwatch-research/taste/work/t5/run-20261016f` (private) |
| `source_digest`: `0571b5780e159c93bf2fb3e5995bbef662ca5ce4d92b781a51370c849013a1c5 c0bd7d82c571fd10da38c3e78168949afd729bb10253617926dea0f6bb398e95 True` | |
| `cases_digest`: `c0bd7d82c571fd10da38c3e78168949afd729bb10253617926dea0f6bb398e95` | |
| `input_digest`: `1330419888451291dd68c994fdbdff2f004d840411b410bd7ff384a3fc0bbc59` | |
| `descriptions_digest`: `365379a87deeba928b9906624c53e74875e8e2e9aea199e39c6a2bd39dea515f` | |
| `prompt_digest`: `8fb4b8a4977357e3618b53b7d320f92eecb3c12aa1c90c455fea39680eaf87ca` | |
| Coverage | 18 structural members, 0 empty S, 12 primary members, 47 triples; excluded: 3 no pair, 3 short list |
| Baselines (member-weighted) | middle mean 39.6%, closest printed mean 33.3%, media type 35.4%, positions A/B/C 31.9/36.1/31.9% |
| Power (one trial per member) | n = 12; 8 correct needed nominally; power 9.1% at the +10-point floor; null SDE 38.1 points |
| Calls | 47 triples × 3 inputs (S, numbers-only, none) × 2 readers = 282, plus at most one transport retry each |
| Cost ceiling | US$75. Haiku measured at about US$0.0006 per call; Astra runs on the Codex login, about 15,600 input tokens per call |
| Tools | Claude Code 2.1.301, Codex CLI 0.162.1, Bun 1.4.3, Python 3.13.11, NumPy 2.5.4, SciPy 1.18.1, scikit-learn 1.9.1 |
| Limits | `nice -n 10`, 2 numeric threads, 30 minutes per reader job, resumed by the registered resume rule |

## Registered draft

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
