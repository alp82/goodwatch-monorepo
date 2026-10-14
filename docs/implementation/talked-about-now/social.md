# Social discovery and matching (#556)

`f/social/discover` collects from ten verified official YouTube channels, nineteen
publisher RSS feeds, bounded Bluesky first-page searches and three Mastodon status
trend endpoints. Reddit was removed from launch by the owner on 2026-10-14; there
is no Reddit adapter or secret. No Meta content or downloaded media is stored.
The inventory is `f/social/inventory.py`, inherited from #539 and #544's verified
Netflix additions. Discovery is bounded inventory, never a platform census.

## Store and ownership

Crate is the only store. Definitions live in `f/social/schema.py` and are registered
in the central `f/sync/models/crate_schemas.py`. The social initializer creates only
its five missing tables. Do **not** run the general initializer as part of local
validation: it can write existing catalog tables. `f/social/store.py` restricts
mutations to these five tables; catalog and Qdrant accesses are read-only. No
Valkey or application clients are imported.

| Table | Primary key | Purpose |
| --- | --- | --- |
| `doc.social_post` | `post_id` | SHA256(source + `:` + native ID), source ID, permalink, author ID/name, publication/discovery/seen/checked times, at most 1,000 text and 1,800 context characters, provenance, content/processed hashes, matcher version, deletion tombstone. |
| `doc.social_title_link` | `(media_type, media_tmdb_id, post_id)` | Automatic links with lane, confidence/basis, bounded reason, matcher/content version, duplicate group, created time and optional operator hide fields. |
| `doc.social_link_report` | `report_id` | SHA256(`media_type:tmdb_id:post_id`), title/post identity, optional 500-character reason, open/confirmed/dismissed status, first report time. No member identity or IP. |
| `doc.social_content_quality` | `post_id` | Exact content hash, gate version, pass/reject status, bounded JSON reasons and link/account evidence, checked_at. Missing/stale decisions fail closed. |
| `doc.social_ingest_run` | `run_id` | Source, requested window, start/finish/status, collected/processed/published counts, bounded collection audit/errors, matcher version and returned API usage cost. |

Social identities use `movie` / `tv`, with numeric TMDB IDs. Existing Crate title
and credit tables use `movie` / `show`; the matcher translates at that boundary.
Hashes make reruns idempotent. Changed post text is rematched; until processing
finishes, the read query rejects links whose content hash differs. A rejected
reprocessing removes old links. Matching never clears operator hides or reports.

Posts, links and quality evidence retain thirty days by publication time; content-free deletion
ID tombstones retain thirty days from removal; reports retain 180 days and runs
ninety days. Maintenance deletes dependent links before expired posts. Deletion
purges text, context, author identifiers/name, URL, provenance and quality evidence immediately;
only the hashed post identity, source, timestamps and processing hashes remain to prevent reingestion. Native IDs are purged too, since Bluesky AT URIs contain the author DID. Reports contain only hashed
post identity and user-supplied reason. Do not put personal data into reasons.

## Matching

`rules.py` copies the frozen #544 round-two model, prompts and foreground
preparation from `prototype/talked-about-now-matching` commit `f7319660`.
The production chain is:

1. A unique `official=true` catalog YouTube video-ID crosswalk for an allowlisted
   channel publishes with the `official_video_id` lane.
2. Other posts use foreground extraction (up to three works, confidence ≥0.90,
   literal mention and evidence required), after boilerplate stripping.
3. Current Crate title/original and alternate names supply exact candidates;
   indexed typo-tolerant fuzzy candidates require ≥88 (the prototype used a local first-token index). Type/year signals rank up
   to eighteen candidates per entity. Current synopsis, director/creator/writer
   and top-eight cast context are loaded only for retained candidates.
4. Missing lexical candidates can query Qdrant's `text_multi_v1` vector, using
   the shared production multilingual E5 encoder and `query: ` prefix (ADR 0002).
   Vector neighbors are proposals only. Unlike the throwaway prototype's model
   cache, this uses the repository's production model and verified download.
5. Every non-crosswalk link must pass the frozen identity rejection gate with
   confidence ≥0.97, a supplied candidate ID, and explicit disambiguation when
   several exact-name candidates exist. Malformed batches retry, then split to
   singleton requests. Exhausted 429/transient HTTP failures stop the source until the next run rather than fan out into more requests. Unknown/invented IDs and non-finite confidence are rejected.

All accepted lanes publish automatically per the owner's #544 decision. Model
self-reports and the crosswalk's rule score are **not calibrated probabilities**.
The prototype measured 91% YouTube / 78% RSS / 97% Bluesky precision; those figures
are prior evidence, not this implementation's production acceptance result.
Readers can disable individual lanes through `disabled_lanes` (recommend a shared
webapp `SOCIAL_DISABLED_LANES` environment setting) without rematching. Operators
can hide one link via `hidden_at` / `hidden_reason` in the new link table.

YouTube trailers are collapsed per title at read time using normalized foreground
name + teaser/trailer + cut number + explicit language. Distributor suffixes are
ignored. Different languages/cuts remain separate; exact post identity stays in
storage. Heuristic groups can still miss differently named edits. Ordinary clips
and non-YouTube posts retain their own group. The window rank is computed before
cursor filtering, preventing duplicate trailers reappearing on later pages.

## Content quality before publication

Title identity and publication eligibility are independent. `quality.py` supplies
versioned deterministic decisions **before inference**, and `Store.publish` checks
the saved decision again. `Store.read_title` requires an inner join to
`social_content_quality` with `status='pass'`, `version='content-quality-1'` and
`content_hash=p.content_hash`. **The title-page loader must copy this additional
join**; raw link rows are not a supported read contract. Changed link/profile
metadata invalidates the previous verdict before the post is saved, even when
visible text has not changed. Rejected links are deleted. A later pass requeues a
previously rejected post for matching. Version changes require a re-screen before
old rows can appear. Reports and operator hides remain in force.

- All untrusted sources reject stream/download promotions (including watch free,
  full movie, HD stream, 123movies/FMovies/Putlocker patterns, common compact
  promotional hashtags and invisible-character variants), known shorteners and
  redirect/link-hub domains, and text without three words/twelve letters after
  removing hashtags and URLs. RSS can use the editorial summary for substance;
  social link-card descriptions cannot supply the missing discussion.
- Bluesky additionally requires complete facet/embed URL targets and public
  profile evidence. All outbound domains must be among **17** editorial domains
  listed in `BLUESKY_OUTLETS` (verified feed outlets plus BBC, The Guardian and
  Roger Ebert). Exact hosts/subdomains are matched, never substrings. General
  video, file and social hosts, including YouTube and Letterboxd, are excluded.
  Legitimate links outside this intentionally small inventory are also rejected;
  the gate makes no accusation about their legality. No promoted URL is fetched
  or a shortener resolved. Nested quoted-record links and image alt text are
  checked too. Missing link/profile/age/count data and hydration failures reject.
- Accounts younger than seven days, lifetime posting rates over 100 posts/day,
  no profile (no display name, biography or avatar), declared bot labels/flags,
  frame/timestamp feeds and authors with three near-identical templates (at least
  40 characters, similarity >=0.82 after URL/hashtag/number removal) reject.
  Pattern detection uses the rolling stored author corpus, not just the current
  batch, and revokes older links by the same bot/template author. These are
  conservative heuristics, not proof that every automation pattern is detected.
- Mastodon collects HTML hrefs, creation/count/profile signals and the native bot
  flag; generic text/link/account/pattern rules apply without the Bluesky outlet
  restriction. Legacy rows lacking link evidence fail closed until re-collected.
  RSS uses its known publisher inventory and scans text, permalink and description
  links; publisher syndication is not treated as a social bot account.
- Only inventory-verified official YouTube channel IDs on YouTube permalinks get
  the trusted source exemption, so legitimate distributor promos remain eligible.

Minimal evidence stores link targets, bounded card/alt text and account presence,
creation date, post count and bot signals, not full profiles or timelines. It is
purged on deletion/opt-out and expires with the post after thirty days. No new
secret is required. Quality counts and reasons appear in each ingest run audit.

The re-screen driver defaults to a read-only preview; `--apply` writes only the
social-owned tables and unpublishes failures. It hydrates current Bluesky records
and profiles through fixed AppView endpoints; network failures fail closed. Output
contains per-source before/after counts, reason counts, a zero-nonpassing-links
check and thirty previously published rejected examples. Destination URLs are
redacted in example text; only social permalinks are linked.

```sh
python goodwatch-flows/scripts/social_quality.py --env-file /path/to/production.env \
  --output /path/to/quality-preview.json
python goodwatch-flows/scripts/social_quality.py --env-file /path/to/production.env \
  --apply --output /path/to/quality-applied.json
```

## Webapp read contract

The tested reference is `Store.read_title(media_type, tmdb_id, limit=50,
disabled_lanes=(), before=None)`. It executes a parameterized join of links/posts,
left-joins open/confirmed reports and filters report matches, deleted posts,
operator hides, disabled lanes, expired posts, obsolete content hashes and absent/stale/rejected content-quality verdicts. It
orders by `(published_at DESC, post_id DESC)`, deduplicates trailer groups, and
accepts the last item's `(published_at, post_id)` as a strict keyset cursor.
Limits are 1–100. Do not fetch raw links and omit these visibility filters.
The Python reference query is executable SQL for the webapp implementation;
there is no live webapp endpoint in this ticket.

Suggested GET response shape for the title-page server loader:

```json
{
  "items": [{
    "post_id": "<64 hexadecimal characters>",
    "source": "youtube|rss|bluesky|mastodon",
    "source_id": "<native ID or URI>",
    "url": "https://source.example/post",
    "author": "Publisher or author",
    "published_at": "2026-10-14T12:00:00Z",
    "text": "Headline or short post text",
    "lane": "foreground_exact",
    "confidence": 0.99,
    "confidence_basis": "llm_self_report_not_calibrated"
  }],
  "next_cursor": null
}
```

Convert Crate epoch milliseconds to ISO UTC at the response boundary. Do not
serve source images before an embed is loaded. The API may omit matcher fields
from the member-facing response; they are diagnostics, not a quality claim.

## Wrong-title write contract (title-page ticket)

`POST /api/social/wrong-title` with JSON:

```json
{"media_type":"movie","media_tmdb_id":438631,"post_id":"<64 hex>","reason":"Optional wrong-version explanation"}
```

The webapp owns the endpoint, same-origin/CSRF checks, body limits, rate limiting
and cache invalidation. The browser never connects to Crate. Validate movie/tv,
positive integer ID, post hash, and that the exact link exists. The reference
`Store.report` implements the following parameterized write:

```sql
INSERT INTO doc.social_link_report
  (report_id,media_type,media_tmdb_id,post_id,reason,status,created_at)
VALUES (?,?,?,?,?,'open',?)
ON CONFLICT (report_id) DO UPDATE SET status='open',reason=excluded.reason
```

Refresh `doc.social_link_report` **before** acknowledging. The read query's report
anti-join hides the link without requiring a second update on the link table.
Return `200 {"report_id":"<hash>","hidden":true}`; retries use the same report ID.
Return 400 for invalid input, 404 for a nonexistent link, 429 for rate limiting,
and 503 on persistence/refresh failure; never return success before the write is
visible. A new report reopens an explicitly dismissed report; otherwise only an
operator dismissal restores the link. Retain the first report timestamp.

The endpoint must invalidate title and start-page caches containing the item and
remove it from the active UI. Cache loaders must reapply the report filter; never
fall back to an old cached card after successful reporting. A report cannot hide
an unrelated title link to the same multi-title post. Review workflow queries
`status='open'`; operators confirm or dismiss and refresh the report table.

## Deletions and opt-outs

`f/social/deletion_sync` checks a bounded oldest-checked set, optionally restricted by `source` for diagnostics. Bluesky collection
checks post, embedded author and batched author-profile labels before storing;
`!no-unauthenticated` is excluded. Sync repeats profile/post checks and removes
missing posts and opt-outs. An author opt-out purges every stored post by that author, including posts outside the current check batch; a post-only label removes that post. YouTube checks `videos.list` with an API key, or
oEmbed without one. RSS and Mastodon existence checks stream only response
headers from public permalinks, reject private addresses and validate redirects.
Definitive 404/410 or an explicit absent post removes the card; 403/429/timeouts
and malformed responses are unknown and retained for later checking. Rotation
advances `checked_at` even on unknowns so one broken site cannot starve others.
No custom Mastodon instance or URL can be supplied through flow arguments.

## Local operation and verification

```sh
python -m venv /tmp/gw-social
/tmp/gw-social/bin/pip install -r goodwatch-flows/tests/requirements-social.txt
/tmp/gw-social/bin/python -m unittest discover -s goodwatch-flows/tests -p 'test_social*.py'

# Authorized production checks: writes only NEW social tables; cleans its fixtures.
SOCIAL_TEST_ENV_FILE=/path/to/production.env /tmp/gw-social/bin/python \
  -m unittest discover -s goodwatch-flows/tests -p test_social_crate.py

# Backfill rolling feeds/search, not an exhaustive historical archive.
/tmp/gw-social/bin/python goodwatch-flows/scripts/social.py ingest \
  --env-file /path/to/production.env --days 7 --pages 6 --max-posts 10000 \
  --output /tmp/social-run.json
/tmp/gw-social/bin/python goodwatch-flows/scripts/social.py counts --env-file /path/to/production.env
/tmp/gw-social/bin/python goodwatch-flows/scripts/social.py read --env-file /path/to/production.env --title movie:438631
/tmp/gw-social/bin/python goodwatch-flows/scripts/social.py maintenance --env-file /path/to/production.env --max-posts 2000
```

Unit tests substitute external HTTP/SQL boundaries, including profile opt-out,
rate-limit handling, grounded proposals and exact-name collisions. Opt-in Crate
tests prove real report/rerun, deletion/tombstone, stale-link removal, lane control
and trailer-collapse behavior through the public store methods. They use only
fixture rows in the new tables and remove them afterwards.

## After merge

The main-branch workflow syncs checked-in scripts/flows to Windmill. No live
schedule or secret is created by this branch. Provision/verify `u/Alp/CRATE_HOSTS`,
`CRATE_USER`, `CRATE_PASS`, `OPENROUTER_API_KEY_SOCIAL`, and existing `QDRANT_HOST` / `QDRANT_PORT` / `QDRANT_API_KEY` (or a `QDRANT_URL` override).
`YOUTUBE_API_KEY` is optional but needed for paginated uploads playlists; without
it, official channel feeds work with a rolling approximately fifteen-upload
inventory. Social uses its own OpenRouter key; the shared DNA variable
`u/Alp/OPENROUTER_API_KEY` is never read as a fallback. Local discovery requires
`OPENROUTER_API_KEY_SOCIAL` in its env file/environment too. Missing or empty
social credentials fail discovery before database access. Deletion/opt-out sync
does not require an inference key. No new Crate resource is needed.

### Separate-key cutover (manual enable only)

Discovery was stopped on 2026-10-14 to protect DNA's shared $1/day allowance.
The four discovery schedules have `enabled=false`, not just an expiring pause;
the 2026-10-15 00:05 UTC all-source retry was cancelled. Deletion sync stays on.
Keep discovery off until the owner chooses a social budget and authorizes restart.

1. Create a **new** OpenRouter inference key with the owner's chosen daily cap.
   Do not reuse the DNA key or change its cap. Per-key caps still share any
   account-level credit/budget constraints.
2. Create secret Windmill variable `u/Alp/OPENROUTER_API_KEY_SOCIAL` in workspace
   `goodwatch`, readable by the discovery run identity `u/Alp`. Do not create an
   alias to `u/Alp/OPENROUTER_API_KEY`. Repository sync skips secrets/variables.
3. Merge the dedicated-key change only after authorization; let the main workflow
   deploy it. Verify deployed `f/social/settings` loads only the social inference
   variable and `f/social/ingest` requires it. Until that deploy, the live discovery
   code still reads the shared key: do not manually run discovery.
4. With discovery schedules still disabled, manually run `f/social/discover`
   once with `source=all, days=2, pages=2, max_posts=400, vector_enabled=true`.
   Check green completion, source counts/costs in `social_ingest_run`, and spend
   on the **new** key. Leave schedules off if validation fails.
5. Re-enable these existing schedules explicitly, preserving UTC, arguments,
   concurrency limits and overlap protection:

   | Schedule | Source | UTC cron |
   | --- | --- | --- |
   | `f/social/discover_youtube` | youtube | `0 0 * * * *` |
   | `f/social/discover_rss` | rss | `0 20 * * * *` |
   | `f/social/discover_bluesky` | bluesky | `0 40 * * * *` |
   | `f/social/discover_mastodon` | mastodon | `0 10 3 * * *` |

   Read back `enabled=true` and confirm subsequent jobs use the dedicated key.
   If any old `paused_until` remains in the future, explicitly clear it as part of
   this authorized restart. Do not recreate the cancelled one-off retry.
6. Leave `f/social/deletion_sync` enabled at `0 50 */6 * * *` UTC, with
   `source=all, limit=2000`; it does not call OpenRouter. Monitor backlog and costs
   against the selected social cap before claiming full hourly coverage.

Schedule `f/social/discover` hourly for each of `source=youtube`, `rss` and
`bluesky` with the other defaults (2-day overlap, two pages,
400 unprocessed posts/source/run). Keep Mastodon available as `source=mastodon`
for a daily or on-demand run: its 77 initial trend posts produced zero links,
which does not justify hourly polling. Schedule `f/social/deletion_sync` every six hours
(limit 2,000), in UTC. Configure a single concurrent discovery run; overlap is
idempotent but wastes inference and may race changed-content processing.
Backfill and deletion limits must be adjusted to measured volume: alert on growing
unprocessed counts, failed/stale-running run records and oldest `checked_at`
approaching a day. More than 400 pending inputs is deliberately carried to later
runs. Check model-cost journals; recorded API cost excludes unreturned requests.

Complete #556 acceptance after three **actual days of production executions**,
then post a manual right/wrong sample of fifty published links for each source.
Historical publication dates and a backfill do not satisfy three days of running.
If a bounded source yields fewer than fifty links, record the shortfall; do not
pad with unrelated or prototype-only matches. Title-page endpoint/UI and cache
invalidation belong to the title-page ticket.
