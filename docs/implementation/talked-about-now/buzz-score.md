# Daily buzz score

Implements [#555](https://github.com/alp82/goodwatch-monorepo/issues/555), part of
[the Talked about now map](https://github.com/alp82/goodwatch-monorepo/issues/537).
The [table design](https://github.com/alp82/goodwatch-monorepo/issues/555#issuecomment-6172741942)
was posted before implementation. This ticket adds no member-facing behavior.

`f/buzz/daily` is the Python entry point; `f/buzz/daily.flow` wraps it.
The enabled `f/buzz/daily` schedule runs hourly at 02:30–23:30 UTC
(`0 30 2-23 * * *`, parser v2, `no_flow_overlap: true`). The scripts and flow
carry a concurrency limit of one (where supported by the Windmill edition). Snapshot publication also uses Crate's
optimistic version check, so a stale writer cannot regress the current date.

## Collection and score

The candidate pool unions the top 250 catalog movies and 250 catalog shows with
the first five pages (up to 100 entries each) of TMDB movie/day and tv/day trending.
Only catalog titles join the score pool; every trending result is retained,
including titles not yet in the catalog. Adult catalog entries are excluded.
TMDB ids are namespaced as `movie:<id>` and `tv:<id>`.

Wikidata P4947 (movies) and P4983 (shows) resolve candidates to en.wikipedia
articles. Multiple different article matches are ambiguous and excluded.
Mappings are checked every 30 days; missing/ambiguous mappings are retried after
seven days. A changed article invalidates cached observations from its old
article for scoring; the replacement article is backfilled.

Wikipedia's `all-access/user` daily endpoint supplies observations. Requests are
sequential with an identifying User-Agent and a half-second pause after each
response. Transport errors, 429s and transient 5xx responses get four bounded
attempts; `Retry-After` is respected up to five minutes. Article 404s and absent
API days are unknown. Real observed zeroes remain zeroes.

The run scores yesterday, never the incomplete current UTC day. Each candidate's
first run fetches 60 days; subsequent runs fill gaps in that window. The score is
promoted from `prototype/talked-about-now-buzz-score`'s `score.py`/`collect.py`;
its `results.md` supplied the floor, missing-data and identity caveats:

```text
mean28 = mean(views[d-28], ..., views[d-1])
score = views[d] / max(mean28, 1)
eligible = views[d] >= 1000 and views[d] - mean28 >= 500
z = (views[d] - mean28) / population_sd28  # NULL when SD is zero
```

All 29 observations must exist. Rank eligible titles by descending score,
descending views, then title key. The movie/show balance affects the candidate
pool, not rank weights. The 14-day curve ends on the scored day. The initial
60-day capture supports 32 scored days, with a complete baseline for each.

Before any TMDB, mapping or bulk pageview work, an existing Wikipedia dated snapshot ends
an attempt successfully (`already_published`), repairing `current` if a prior run
stopped between publication writes. Otherwise probe only the requested UTC day
for Breaking Bad and, only if absent there, The Godfather. One actual observation
(including zero) allows collection; two missing observations check whether all 24 hourly dump files exist before
collecting candidates. If any file is absent, return `waiting_for_publication`.
API probes use the normal polite HTTP adapter.

When the API lacks yesterday but all hourly files exist, stream gzip files
sequentially from `dumps.wikimedia.org/other/pageviews`, summing exact article
DBkeys under `en` and `en.m`. Filenames mark the **end** of the hour: day D is
D-010000 through D+1-000000 (including month/year directory rollover).
The [format docs](https://wikitech.wikimedia.org/wiki/Data_Platform/Data_Lake/Traffic/Pageviews)
describe the four columns and decoded titles. More precisely, the
[producer query](https://github.com/wikimedia/analytics-refinery/blob/5a3e9d2b6f7230a9d94ebf69a3e55dfa5fcd0400/hql/pageview/hourly/transform_pageview_to_legacy_format.hql)
filters `agent_type = 'user'`, excluding both `spider` and `automated`, and
combines mobile web and mobile app in `.m`. Thus `en` + `en.m` corresponds to
API `en.wikipedia.org/all-access/user`; there is no agent column to filter locally.
Do not decode dump titles again or include redirects/other projects.

The collector uses the identifying UA, 10s connect/30s read timeouts, four
HTTP attempts with bounded Retry-After, a 3-minute availability budget and a
20-minute streaming budget (checked between reads, plus any in-flight read).
Corrupt/interrupted gzip streams retry the hour up to three times with fresh
counters. Memory holds only candidate totals and at most a 64 KiB line; no dump
is written to disk. A missing file or failed stream never persists partial-day
counts. Absence of an article becomes zero only after all 24 files validate.
API history still supplies the baseline; the 80% coverage guard still applies.
Observations record `wikipedia_api` or `wikipedia_dumps` in `buzz_pageview.source`.
The offline fixture tests domain filtering, app-inclusive mobile counts,
Unicode, literal percent escapes, zeroes, truncated gzip and day boundaries.
A new full-day live equivalence/throughput measurement has not been run.

If fewer than 80% of mapped titles have the latest 29 observations, preserve
`current` and return `waiting_for_coverage`; successfully collected observations
are retained for the next attempt. Missing publication or coverage raises a real
failure at the final attempt (23:30 UTC or later). HTTP and other operational
errors still fail visibly. Once collection succeeds, later hourly attempts do
no signal requests or collection. Source/formula copies remain immutable; preferred date aliases and `current`
use optimistic concurrency checks and the replacement rule below.

The webapp reads `current` without a wall-clock freshness cutoff in
`app/server/talked-about-now/start-row.server.ts`, and caches it for ten minutes.
It therefore continues serving the previous snapshot while publication is late;
the parsed row now also exposes the snapshot source.

Reasons are dated context hints, not claimed causes of the attention lift.
Release/first-air dates, later season premiere dates and official YouTube trailers
come from TMDB; recent means the scored day and 13 preceding days. Netflix weeks
become available on the Tuesday after their Sunday end date; the latest published
week is selected globally, and hints older than 14 days are omitted. A Netflix
match requires an exact case-insensitive title/original-title and category with
one catalog identity, including duplicate checks outside the candidate pool.
It stays labelled provisional because Netflix supplies no TMDB identity.
Ambiguous remakes produce no hint. Neither reasons nor trending affect score.
Metadata is fetched now; its event dates do not prove its historical publication
vintage. This limitation is labelled in the backfill and evidence.

## Tables and read contract

All mutations target these five new tables. Existing catalog tables are read-only;
no Valkey client is imported or used.

| Table | Primary key | Data |
| --- | --- | --- |
| `doc.buzz_title` | `title_key` | Catalog identity/card fields, article/QID, mapping status/check time, last candidate time |
| `doc.buzz_pageview` | `title_key`, `day` | ISO UTC date, article, observed views, source, fetch time |
| `doc.buzz_trending` | `snapshot_day`, `kind`, `tmdb_id` | Actual collection UTC date, daily rank/popularity/title, raw TMDB result JSON, fetch time |
| `doc.buzz_score` | `day`, `title_key` | Lift, eligibility/rank, views/mean/SD/z, curve/card/reasons JSON |
| `doc.buzz_snapshot` | `snapshot_key` | Scored day, generation time, complete top-20 payload JSON; keys `current`, ISO date aliases and `day:source:formula_version` history |

JSON fields are `TEXT INDEX OFF`, decoded once by the reader. Tables have one
shard and one replica. Date strings sort chronologically. There is no pretend
historical TMDB trending backfill. The first complete daily trending snapshot is
retained and reused on retries. An `expected_count` field detects partial bulk
writes, which are recollected and replaced in full. Retrying cannot combine
different captures of the day.

Owner decision (2026-10-18): source/formula snapshots are immutable, but a
fallback day's preferred date alias may be superseded by Wikipedia. API and
dumps have equal priority, both above any other source; the first Wikipedia
publication wins. New publications include `source` and `formula_version` and
retain `day:source:formula_version` copies. The ISO date key remains the preferred
snapshot for existing readers. A fallback is archived before its alias is
replaced. `current` prefers the newest day, then Wikipedia on the same day;
catching up an older day never regresses it. Both alias updates use CAS and
bounded retries. Reruns repair interrupted publication. Fresh historical
backfill does not advance `current`; replacement of a previously served fallback
retains its daily status. Fallback dates remain eligible for scoring when
Wikipedia catches up in the 60-day window.

Existing snapshots are not bulk rewritten: missing source or the legacy
`Wikipedia en.wikipedia.org / all-access / user` label is interpreted as
`wikipedia_api`. Legacy aliases are archived lazily before replacement.
`buzz_pageview.source TEXT` is added automatically by `initialize()` on existing
strict-schema tables. Older observations retain NULL, meaning legacy API data.
No manual DDL is needed if the flow identity has ALTER privileges. The webapp's
optional `TalkedRow.source` is populated by `parseSnapshot`, with the same legacy
API default. Payload schema stays at 1 and Wikipedia formula stays
`wikipedia-lift-28d-v1`. `buzz_score` remains the preferred computed score table;
the immutable snapshot payloads retain fallback ranking history.

Scoring failures leave the served payload unchanged. Retention prunes observations,
trending, scores, dated snapshots and unused mappings older than 180 days;
`current` is always retained.

A start-page loader needs one small primary-key read, independent of visitor:

```sql
SELECT day, generated_at, payload
FROM doc.buzz_snapshot WHERE snapshot_key = 'current';
```

Parse `payload` as JSON. Its schema version is `1`; formula version is
`wikipedia-lift-28d-v1`. It contains `day`, `source`, `baseline_days`, `curve_days`,
`candidate_pool_collected_at`, `history_mode`, `diagnostics`, and `top20`.
Each top-20 item has `title_key`, `day`, `rank`, `score`, `eligible`, `views`,
`mean28`, `sd28`, nullable `z`, `curve` (`[{day, views}]`), `card`, and `reasons`.
The card includes kind, TMDB id, title/original title, poster path, release date,
popularity and Wikipedia mapping. A missing snapshot should omit the row;
it must not make per-title fallbacks or initialize the store during a page read.
Use `day` for freshness and `generated_at` for when the payload was built.
The source measures reading attention, not measured social mention volume.

## Run locally and verify

```sh
python -m pip install -r goodwatch-flows/tests/requirements-buzz.txt
python -m unittest discover -s goodwatch-flows/tests -p 'test_buzz.py'

python goodwatch-flows/tools/run_buzz.py \
  --env /path/to/goodwatch-webapp/.env --output /tmp/buzz-run.json
python goodwatch-flows/tools/run_buzz.py \
  --env /path/to/goodwatch-webapp/.env --verify --output /tmp/buzz-evidence.json
```

The local driver invokes the same `run` function with a Crate HTTP adapter. Its
mutation allowlist rejects every table except these five and never prints secret
values. `--verify` performs SELECTs only and measures 30 reads of the actual
page-loader query, including network roundtrip and Crate execution duration.
Tests use unittest and fake HTTP/Crate services, covering missing days and true
zeroes, baseline/floors/ties, dated hints, retries, identity ambiguity, daily
backfill/retry, source delay, article remapping and snapshot concurrency.

## After merge

The main-branch Actions sync deploys the scripts and flow to Windmill. Do not push
this branch to main directly. Schedule sync is intentionally opt-in: after merge,
apply the versioned buzz schedule with the pinned CLI from
`goodwatch-flows/windmill` (restricted to this feature):

```sh
npx --yes windmill-cli@1.803.0 sync push --yes --keep-deleted \
  --skip-variables --skip-secrets --skip-resources --skip-resource-types \
  --include-schedules --includes 'f/buzz/**' --workspace goodwatch
```

Read back `f/buzz/daily` and its next queued job to confirm the enabled UTC hourly
schedule, flow target, overlap protection and final 23:30 attempt. Trigger the
flow once to verify a cheap wait or a publication, then repeat after publication
to verify `already_published`. Keep the 80% guard; missing days are never zeroes.

Reuse these existing Windmill variables; no new vendor credentials are needed:
`u/Alp/CRATE_HOSTS`, `u/Alp/CRATE_USER`, `u/Alp/CRATE_PASS`,
`u/Alp/TMDB_API_KEY`. The executing identity needs read access to the catalog and
write/CREATE privileges only for the new buzz tables. CI still requires existing
`WMILL_URL` and `WMILL_TOKEN` Actions secrets. Dependency locks and hashes are
produced with the repository's pinned Windmill CLI 1.803.0.

Keep #555 open until three separate daily production runs have succeeded and
all three daily top-20 lists have been posted there. A historical backfill is
useful evidence, but cannot satisfy three prospective daily runs. The frontend
consumer and social-content flows are other tickets in the map.

API references: [Wikimedia pageviews](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html),
[TMDB daily trending](https://developer.themoviedb.org/reference/trending-movies),
[Windmill dependency locks](https://www.windmill.dev/docs/advanced/dependencies_in_python).

## Backup ranking when Wikipedia is late

`backup_signals`, formula `signals-rrf-28d-v1`, publishes from **09:30 UTC**
when yesterday is absent from both API probes and the complete hourly dumps.
The hour after the signals schedule leaves a margin for collection. The backup
claims **yesterday's capture/export date**, never today's observations shifted
back a day. Thus Trakt first captured on October 18 participates for October 18
on October 19. TMDB's underlying activity window remains undocumented.
No backup is used for a partially recovered Wikipedia cohort (coverage failures).

Candidates use exactly `store.candidates`: catalog top 250 per kind plus catalog
members of today's persisted/fresh TMDB trending capture. Only signal rows
whose source/day run status is `works` count. Partial, blocked and absent sources
are excluded, including from baselines. Missing signal tables yield no backup.
At least **20 eligible candidates** are required; otherwise keep current and
retain the normal final-attempt failure. A successful backup is sufficient at
the final attempt. No reason metadata or Wikipedia mappings are fetched for it.

For each source/title, require an actual finite, nonnegative observation on the
scored day. With all 28 preceding calendar days, compute
`lift = value / max(mean28, floor)`. Never fill absent days with zero:

| Source | Value | Denominator floor | Eligibility |
| --- | --- | --- | --- |
| TMDB | popularity | 1 | Complete baseline, value ≥5 and increase ≥2.5 (backtest floors) |
| Trakt trending | watchers | 5 | value ≥5; with baseline also increase ≥2 |
| JustWatch US | 1 / streaming chart rank | 0.01 | positive; with baseline lift >1 |

Within each source, order by lift when available, otherwise raw value (only
Trakt/JustWatch have this cold-start mode), then value, JustWatch `UP` trend,
then title key. Each eligible source contributes **1 / (60 + source rank)**.
Sum contributions with equal weights; missing sources contribute nothing.
Final order is descending sum then ascending title key. This intentionally
rewards agreement, without renormalizing away missing sources. As history grows,
individual titles automatically switch to lift; mixed-baseline periods compare
lift and raw values and can change the list's character. These exploratory
floors and ranks are not calibrated evidence of better quality than Wikipedia.
`trakt_watched_daily` is excluded to avoid counting the same audience twice.

Top-level `sources_used` lists contributors to the top 20. Each row adds:

```json
{
  "kind": "backup",
  "sources_used": ["tmdb_popularity", "trakt_trending", "justwatch_chart"],
  "source_lifts": {"tmdb_popularity": 2.0},
  "tmdb_lift": 2.0,
  "trakt_watchers": 12,
  "justwatch_rank": 4,
  "justwatch_country": "US",
  "justwatch_trend": "UP"
}
```

This object is the row's `signal` field. A [complete generated example row](buzz-backup-row-example.json) shows the exact JSON shape, including all 14 curve points. Source-specific fields are omitted when
that source did not contribute; `source_lifts` gains Trakt/JustWatch keys after
complete baselines exist. The regular row `score` (and parsed `lift`) is the
**RRF sum, not a × multiplier**. `views`, `mean28` and the 14 dated `curve[].views`
are TMDB popularity, its complete 28-day mean, and its daily popularity history;
unknown values are JSON null. `sd28` and `z` are null, `reasons` is empty.
`eligible`, `rank`, `title_key`, `day`, and `card` retain their existing shapes.
For compatibility with existing numeric presentation types, `parseSnapshot`
uses 0 placeholders for null `views`/`mean28` and omits unknown curve points
(possibly leaving an empty curve). These placeholders must not be labelled as
measured zeroes or Wikipedia views. UI wording must branch on `signal.kind`;
`signal.tmdb_lift` is the optional real multiplier. No UI components change here.
The loader passes `sources_used` and `signal` through; movement retains the
existing comparison with the previous day's preferred ranking, even across sources.

Backups write **snapshots only**, not `buzz_score` (whose BIGINT views and Wikipedia
semantics remain unchanged). No DDL/schema migration is introduced; payload
schema stays 1. Existing CAS publication keeps `day:backup_signals:signals-rrf-28d-v1`
immutable, advances current only to newer dates, and lets Wikipedia replace the
same day's alias/current without losing the backup. Wikipedia catch-up keeps
using the existing 60-day window and coverage guard.

A SELECT-only local preview, with no initialization, REFRESH, source network
collection, or publication:

```sh
python goodwatch-flows/tools/run_buzz.py --env /path/to/production.env \
  --backup-dry-run 2026-10-17 --output /tmp/buzz-backup-preview.json
```

It uses the latest complete **stored** trending capture plus the current catalog;
therefore candidate membership may differ from a future live daily capture.
It returns `insufficient_signals` rather than an empty publishable snapshot.
This change has not been deployed or exercised against production data.


Validation for this change: 69 offline Python tests and 47 requested webapp tests
passed. The full webapp typecheck reports errors outside the changed files.
`goodwatch-benchmark/bench.sh budget` stops because `SHARE_LIST_PATH` is unset;
no landing-surface budget result is claimed. Existing dependency locks are
unchanged (no new third-party imports); the new pure backup module has an empty
Python 3.12 lock. Metadata content hashes were refreshed locally using the
existing CLI hash format, without running remote dependency jobs.
