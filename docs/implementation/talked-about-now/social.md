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
its four missing tables. Do **not** run the general initializer as part of local
validation: it can write existing catalog tables. `f/social/store.py` restricts
mutations to these four tables; catalog and Qdrant accesses are read-only. No
Valkey or application clients are imported.

| Table | Primary key | Purpose |
| --- | --- | --- |
| `doc.social_post` | `post_id` | SHA256(source + `:` + native ID), source ID, permalink, author ID/name, publication/discovery/seen/checked times, at most 1,000 text and 1,800 context characters, provenance, content/processed hashes, matcher version, deletion tombstone. |
| `doc.social_title_link` | `(media_type, media_tmdb_id, post_id)` | Automatic links with lane, confidence/basis, bounded reason, matcher/content version, duplicate group, created time and optional operator hide fields. |
| `doc.social_link_report` | `report_id` | SHA256(`media_type:tmdb_id:post_id`), title/post identity, optional 500-character reason, open/confirmed/dismissed status, first report time. No member identity or IP. |
| `doc.social_ingest_run` | `run_id` | Source, requested window, start/finish/status, collected/processed/published counts, bounded collection audit/errors, matcher version and returned API usage cost. |

Social identities use `movie` / `tv`, with numeric TMDB IDs. Existing Crate title
and credit tables use `movie` / `show`; the matcher translates at that boundary.
Hashes make reruns idempotent. Changed post text is rematched; until processing
finishes, the read query rejects links whose content hash differs. A rejected
reprocessing removes old links. Matching never clears operator hides or reports.

Posts and links retain thirty days by publication time; content-free deletion
ID tombstones retain thirty days from removal; reports retain 180 days and runs
ninety days. Maintenance deletes dependent links before expired posts. Deletion
purges text, context, author identifiers/name, URL and provenance immediately;
source/native IDs and hashes remain to prevent reingestion. This includes Bluesky
AT URIs, which necessarily contain the author DID. Reports contain only hashed
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

## Webapp read contract

The tested reference is `Store.read_title(media_type, tmdb_id, limit=50,
disabled_lanes=(), before=None)`. It executes a parameterized join of links/posts,
left-joins open/confirmed reports and filters report matches, deleted posts,
operator hides, disabled lanes, expired posts and obsolete content hashes. It
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
missing posts and opt-outs. YouTube checks `videos.list` with an API key, or
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
`CRATE_USER`, `CRATE_PASS`, `OPENROUTER_API_KEY`, and `QDRANT_URL` / `QDRANT_API_KEY`.
`YOUTUBE_API_KEY` is optional but needed for paginated uploads playlists; without
it, official channel feeds work with a rolling approximately fifteen-upload
inventory. Variable names match existing flows; no new Crate resource is needed.

Enable `f/social/discover` hourly with defaults (2-day overlap, two pages,
400 unprocessed posts/source/run), and `f/social/deletion_sync` every six hours
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
