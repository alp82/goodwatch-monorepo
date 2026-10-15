# Talked about now relevance gate — 2026-10-15

Built for map #537 / ticket #556, owner decision Q17. The gate is deterministic and makes no inference or paid-service calls. It writes only the new `doc.social_relevance` table. Existing ingestion behaviour, catalog tables, Valkey and flags are unchanged.

## Frozen audit regression

Every P001–P632 association from [the full audit](relevance-audit-2026-10-15.md) is represented in `goodwatch-flows/tests/fixtures/social/relevance-2026-10-15.json`, with the original stored post text/context, catalog identities, alias evidence, observed public metrics and independent editorial verdict/reason. Labels are separate from judge inputs. The fixture records the capture and read-only alias-query jobs; missing API counts remain null. Tests reconcile all 632 labels, reasons and title/post keys with the Markdown table.

Precision means relevant among kept links; agreement means `(correct keep + correct drop) / all links`. These are title–post associations, not unique posts. Set-level duplicate verdicts use the audit’s chosen representatives, so an alternate respectable representative can still count as a disagreement. Rules were developed against this corpus; this is regression evidence, not an independent holdout score.

| Scope | Links | Keep | Drop | Kept relevant | Kept irrelevant | Precision | Agreement | Relevant lost | Recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Overall | 632 | 272 | 360 | 252 | 20 | 92.6% | 85.0% | 75 | 77.1% |
| youtube | 79 | 30 | 49 | 30 | 0 | 100.0% | 93.7% | 5 | 85.7% |
| rss | 417 | 238 | 179 | 218 | 20 | 91.6% | 78.9% | 68 | 76.2% |
| bluesky | 136 | 4 | 132 | 4 | 0 | 100.0% | 98.5% | 2 | 66.7% |
| mastodon | 0 | 0 | 0 | 0 | 0 | — | — | 0 | — |
| Top 20 | 85 | 41 | 44 | 40 | 1 | 97.6% | 83.5% | 13 | 75.5% |

The ≥90% kept-link relevance bar is met for each non-empty source. Mastodon has no audited links and no measured precision. The stricter requirement of 12 own words applies to reviewed authors as well: Sarah Dempster’s P042 and Xan Brooks’s P045 are both lost. All discarded relevant associations and their decision reasons are in [the complete evaluation](evidence/social-relevance-results-2026-10-15.json).

### Top-20 titles left empty

- Rank 4: Helluva Boss (`tv:289892`).
- Rank 7: Take Charge of My Heart (`tv:289423`).
- Rank 9: Always Lalisa (`movie:1489932`).
- Rank 15: Haunted Hotel (`tv:255752`).
- Rank 16: Hope (`movie:1058424`).

No replacement is fabricated and the Wikipedia ranking is unchanged.

### Ten worst remaining disagreements

Non-duplicate foreground mistakes come first, followed by duplicate disagreements ordered by display score. This order uses the audit labels only for reporting; labels never enter the production judge.

| ID | Linked title | Stored piece | Audit reason |
|---|---|---|---|
| P369 | Avatar | [New ‘Avatar’ Projects Are Everywhere — but the Best One Succeeds by Leaving ‘The Last Airbender’ Behind](https://www.indiewire.com/features/animation/avatar-seven-havens-adaptations-animation-styles-1235221514/) | This is animated Avatar-franchise criticism, with no substantive buzz about the linked James Cameron film. |
| P370 | The Last Airbender | [New ‘Avatar’ Projects Are Everywhere — but the Best One Succeeds by Leaving ‘The Last Airbender’ Behind](https://www.indiewire.com/features/animation/avatar-seven-havens-adaptations-animation-styles-1235221514/) | The focus is new animated Avatar projects rather than substantive coverage of the linked live-action film. |
| P017 | Midday Meal | [Iranian Drama ‘Midday Meal’ Wins Busan Film Festival’s Top Prize, Qualifying for Oscar Consideration](https://www.hollywoodreporter.com/movies/movie-news/midday-meal-iran-movie-busan-award-qualifies-oscars-1236730784/) | Same Busan best-film/Oscar-qualification event as ID 11, without a distinct angle in stored text. |
| P029 | Midday Meal | [Majid Majidi’s ‘Midday Meal’ Wins Busan Best Film Award; Qualifies For Oscars Consideration](https://deadline.com/2026/10/majid-majidi-midday-meal-iran-busan-best-film-oscars-1237157907/) | Third account of the Busan best-film/Oscar event already represented by ID 11. |
| P054 | Even Stevens | [Christy Carlson Romano Says She Was Paid Half of Shia LaBeouf’s Salary on ‘Even Stevens’](https://www.hollywoodreporter.com/tv/tv-news/christy-carlson-romano-paid-half-shia-labeouf-even-stevens-1236730514/) | Same Even Stevens pay disclosure already represented by ID 28. |
| P158 | Victoria | [Mark Duplass Joins Hulu Limited Series ‘Victoria’](https://deadline.com/2026/10/mark-duplass-cast-hulu-limited-series-victoria-1237157033/) | Same Mark Duplass casting announcement already covered by ID 156. |
| P170 | South Park | [‘South Park’ Takes On Aura Battles in Midseason Episode](https://www.hollywoodreporter.com/tv/tv-news/south-park-season-29-you-like-that-on-your-face-logline-1236729955/) | Same current South Park episode recap already represented by ID 53. |
| P180 | Tutu | [SFFILM’s Doc Stories To Open With Ava DuVernay’s ‘14th,’ Showcase ‘Tutu,’ ‘Black Sunflowers,’ ’Soul Patrol’ & More](https://deadline.com/2026/10/sffilm-doc-stories-2026-lineup-announcement-1237156521/) | Same Doc Stories Tutu selection already represented by ID 178. |
| P296 | Yellowjackets | [‘Yellowjackets’ Season 4 Trailer: The Wilderness Survivors Return Home](https://variety.com/2026/tv/news/yellowjackets-season-4-trailer-shauna-mista-van-1236910976/) | Same Yellowjackets teaser/homecoming event already represented by ID 283. |
| P298 | Yellowjackets | [‘Yellowjackets’: First Footage of Final Season Shows the Long-Awaited Homecoming](https://www.hollywoodreporter.com/tv/tv-news/yellowjackets-final-season-4-first-look-rescue-1236729332/) | Same Yellowjackets teaser/homecoming event already represented by ID 283. |

The complete evaluation records all remaining disagreements and all lost relevant links. Some duplicate disagreements are alternate representatives, rather than intrinsically poor articles. The two Avatar links remain actual foreground/identity mistakes in legacy links; the rules do not claim to repair every historical matcher error.

## Gate and persistence

- Publication windows are inclusive: news/social 0–7 days, verified official videos 0–14 days, always from `published_at`. Unknown and future dates fail.
- YouTube needs a stable channel from the existing verified inventory and a substantive format. Leading descriptions can establish a real scene/craft feature. Countdowns and game/brand activations fail. Known older catalog titles need a current hook; a bare old season number does not establish one. Unknown release year alone is not evidence of an archive upload.
- RSS uses the audit’s exact A/B outlet tiers and separate concrete-announcement handling for official Netflix press. Routine availability/schedule, giveaway, merchandise, gallery/list and personal-career headlines fail. Foreground checks reuse extracted mention cues, catalog/original titles and alternative titles, including accent folding and body-supported editorial subjects. Reference-only credits/comparators and conflicting canonical aliases fail. This is not English-headline equality.
- Bluesky/Mastodon need a reviewed stable ID, or `(likes + reposts + quotes >= 20 and followers >= 500)`, or `E >= 100`. Replies are retained but excluded from E. Every route also needs 12 own words after URL/hashtag/title removal and copied-card span subtraction, plus a foreground title. The checked-in seven-author registry records role evidence and review date. Missing counts fail the measured-reach route; no missing count is stored as zero. Older Mastodon servers omitting quote counts therefore fail closed.
- Explicit stored republication notices fail. There is no full-article crawler or invented original-publication date. A fresh RSS timestamp cannot override a notice present in stored text.
- Canonical outgoing article URLs collapse cross-source shares, preferring original RSS. Social contributions with at least 24 independent own words can retain their own angle. Trailer/teaser + cut/season/variant/date groups, headline Jaccard ≥0.8, and the specified repeated event classes collapse within 72 hours. Distinct known cuts, dates and analytical/review/interview angles remain separate. Renewal and Doc Stories lineup repeats are also recognized. No generic one-story-per-title cap exists.
- Kept scores are authority × evidenced substance × publication freshness. Duplicate choice prefers official assets/English versions, then original RSS and authority/score, with stable timestamp/post-ID tie-breaks. Duplicate losers have `status=drop`, share the winner’s `dup_group`, and record `duplicate_of:<post_id>`.
- The shared schema is exact: `(media_type TEXT, media_tmdb_id BIGINT, post_id TEXT)` primary key; `version`, `content_hash`, `status`, `kind`, `score DOUBLE`, `dup_group`, `reasons ARRAY(TEXT)`, `judged_at TIMESTAMP`. Version is `relevance-1`. No extra column was added. To keep all new writes in this table, API counts and their observation time are stored as a JSON `metrics:` entry in reasons. Counts travel in ephemeral adapter `relevance_evidence`, separate from persisted content-quality evidence. These reason entries are internal diagnostic data.
- Ingest runs the gate after the content-quality gate, matching and publication have completed. It rejudges the entire bounded active link set, so duplicates work across batches and sources, including links already processed by the matcher. The read query preserves quality/version/hash, hidden/deleted and report protections. A missing catalog record fails closed. Corpus overflow aborts before any relevance write.
- `RelevanceCrate` independently rejects all mutations except creating/upserting/refreshing `doc.social_relevance` in apply mode. An older run cannot overwrite a newer judgement. Preview does not create the table. The gate never changes existing link rows, flags or Valkey.

## Verification and operations

Passed the social suite with an isolated localhost CrateDB 5.10.16 instance: **60 passed, 12 skipped** (72 discovered). The skips are the pre-existing tests requiring authorization to modify existing production social tables; they were deliberately not enabled. The new real-database test writes only local `doc.social_relevance` and verifies all 632 upserts, typed array reasons, a 5,000,000,000 TMDB key, and protection against stale upserts. Unit/regression checks cover freshness, formats/hooks, aliases/body focus, copied cards, missing metrics, source adapters, duplicate cuts/time boundaries, independent reviews, the default read-only boundary and forbidden writes.

A real production **read-only** Windmill preview succeeded using the candidate modules in memory, without deploying them: [job 01a1407d-623b-191d-902b-cc740ed92c57](https://windmill.goodwatch.app/api/w/goodwatch/jobs_u/completed/get_result/01a1407d-623b-191d-902b-cc740ed92c57). It judged 642 current raw associations: YouTube 30 keep / 51 drop, RSS 246 / 179, Bluesky 4 / 132, Mastodon 0 / 0, with zero hydration errors. This differs from the 632-row audit because it includes current ingestion and the two legacy duplicate representatives removed by the old read. The live preview is not human-labelled validation. [Preview evidence](evidence/social-relevance-preview-2026-10-15.json).

Reproduce offline regression:

```bash
python goodwatch-flows/tools/social_relevance_eval.py --output /tmp/relevance-results.json
python -m unittest discover -s goodwatch-flows/tests -p "test_social*.py"
```

Re-judge CLI (environment settings or a private env file; preview is the default):

```bash
python goodwatch-flows/tools/social_rejudge.py --env /private/crate.env --output /tmp/relevance-preview.json
python goodwatch-flows/tools/social_rejudge.py --env /private/crate.env --apply --output /tmp/relevance-applied.json
```

After the owner merges the PR:

1. Let the main-branch Windmill sync deploy the checked-in social scripts/locks; verify its success and deployed content hashes. If needed, retry only the scoped social script deployment. Do not change schedules or flags.
2. Run deployed `f/social/rejudge` with `{"apply":false}` and retain the result. Default re-judging hydrates current public Bluesky post/profile evidence; failures remain explicit and fail closed. Existing Mastodon rows use already stored observations, with unknown counts failing the threshold route.
3. Run deployed `f/social/rejudge` with `{"apply":true}`. This may create the new table, upsert decisions and refresh it; it cannot modify an existing table or Valkey. Do not run discovery or schema initialization as a backfill substitute.
4. Read back version/status counts and verify link/post/hash matching. Use the webapp reader’s `version='relevance-1' AND status='keep' AND content_hash=p.content_hash`, score-desc/publication-desc order and one per group; preserve its existing quality/report/deletion checks. Counts can differ from the frozen audit as ingestion and freshness advance. Report the applied/read-back counts before claiming production completion.

Production deployment/apply are intentionally pending owner merge. No production data, schedules or flags were changed in this branch preparation.
