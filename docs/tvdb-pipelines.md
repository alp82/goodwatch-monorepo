# TVDB character portraits and awards

The `f/tvdb` Windmill scripts enrich the GoodWatch catalog with character portrayals and award nominations. They use the secret Windmill variable `u/Alp/TVDB_API_KEY`. A webapp `.env` entry does not deploy that secret; it was provisioned separately for the initial rollout.

## Jobs and schedules

All schedules use UTC, independent script entry points and overlap guards. They are enabled in source. The deployment workflow explicitly syncs only `f/tvdb/*.schedule.yaml` with `--include-schedules`, because the normal workspace push skips schedules by default; unrelated schedules keep their existing deployment behavior.

| Job | Schedule | Work |
| --- | --- | --- |
| `seed` | Every 5 minutes, minute 1 modulo 5 | Resume the initial catalog scan in four-minute slices. Once complete, read source changes at most hourly, with a 48-hour overlap. |
| `titles` | Every 5 minutes, minute 0 modulo 5 | Four-minute title worker. Prioritize popular titles within the initial queue, verify external IDs, fetch actor credits and portrait URLs. |
| `mappings` | Every 5 minutes, minute 2 modulo 5 | Four-minute worker for globally cached actor and awards-title identities. |
| `publish` | Every 5 minutes, minute 3 modulo 5 | Retry up to 1,000 pending title scopes and 1,000 pending award category scopes. Crawlers also publish batches. |
| `awards` | Hourly at minute 4 | Up to 12 minutes / 1,000 categories. Discover all award/category indexes daily and refresh category snapshots daily. |
| `changes` | Hourly at minute 12 | Four-minute paginated update-feed reader; resume unfinished pages next hour. |
| `health` | Every 15 minutes, minute 7 modulo 15 | Fail visibly on a table stalled for 30 minutes or a scope rejected three times. Existing schedule monitoring delivers incident/recovery notifications. |
| `photos` | Every 5 minutes, minute 4 modulo 5 | Resume primary actor-photo seeding from stored cast snapshots in four-minute slices; after catching up, scan changes at most hourly. No TVDB requests. |
| `actor_photos` | Every 5 minutes, minute 1 modulo 5 | Publish up to 1,000 primary actor photos onto existing, verified local people. |

One shared API budget caps requests across all jobs at four per second. HTTP 429 establishes a shared cooldown honoring Retry-After; 401 refreshes authentication once, persistent 401/403 fails visibly, and network/server failures preserve successful snapshots. Leases recover work left by a terminated worker. The title reconciliation interval is 30 days; actor/title identity mappings refresh after 180 days or relevant update events.

## Storage and identities

MongoDB holds `tvdb_titles`, `tvdb_entities`, `tvdb_awards`, `tvdb_categories`, queue/checkpoint state in `tvdb_state`, and 30 days of successful worker metrics in `tvdb_runs`.

CrateDB has two source-owned tables, registered in `f/sync/models/crate_schemas.py`:

- `tvdb_character`: title + TVDB role identity, actor identities, role name, character and actor image URLs. `credit_id` is populated only for a unique actor/character match against our TMDB cast credits. Unmapped and ambiguous roles remain available separately.
- `tvdb_nomination`: source nominee identity within its category, ceremony year, winner status, recipient/context when available, verified local title links, and original nominee JSON. Unmatched nominations are retained.

`dedupe_key` groups apparently identical source records for review. It is not proof of a duplicate: missing recipients can make legitimate co-nominees indistinguishable. Never collapse source records or claim definitive award totals solely using this key. Unknown award coverage does not mean zero nominations. Never substitute an actor's name for an absent award recipient.

Each successful source snapshot marks publication pending. Publishing batches upserts before one table refresh and scope reconciliation, then acknowledges the exact source revision. Failed writes or source revisions arriving during publication remain pending. A global publication lease prevents an older publisher from deleting newer rows. TMDB cast replacement does not own either TVDB table. Both are registered for catalog title deletion; source nominations remain in MongoDB and can be republished with an unknown local link on the next category sweep. Source catalog removals are published as empty character snapshots when seen by the seed job.

Character images are stored as external URLs; this pipeline does not download all image binaries. These are portrayals within titles, not a global fictional-character identity or biography. Character-specific UI integration is separate from primary actor photos.

## Update limits

The update reader routes known title, actor, character, category and nominee IDs into the queues. The `seriespeople` API filter returns `characters` events. Newly created character IDs without a known parent rely on title changes or the 30-day title sweep. New nominee IDs carry no category in the observed feed, so the daily category sweep is required. Source category/award index removals are retained for investigation rather than inferred as complete deletions. Failed or incomplete responses never clear an existing snapshot.

## Rollout and population estimate (2026-11-06)

Live probes returned 19 award organizations and 594 categories. Casino Royale supplied 40 actor credits and 11 role portraits; Breaking Bad supplied nine actors and nine portraits. Oscar Best Motion Picture supplied 125 source nomination rows, with gaps in historical coverage. Actor award samples omitted recipients.

The source collections contain approximately 1,372,681 movie documents and 251,707 show documents. Indexed counts found 710,207 movie IMDb IDs and 105,839 show IMDb IDs. Additional shows can resolve through their TVDB IDs; unresolved titles without usable external IDs are skipped. These counts include source entries that may subsequently be excluded as removed or invalid.

The initial end-to-end production benchmark, including publication and concurrent queue seeding, processed 25 matched titles / 51 requests in 31.44 seconds and 40 identity mappings / 41 requests in 22.11 seconds. Four-minute jobs every five minutes imply roughly 55,000 matched titles/day at that observed rate, before contention or API throttling. Unmatched IMDb searches can be faster; actor coverage, new actor identities, publication costs and worker availability affect the result.

Planning estimates from activation:

- Initial queue enumeration: about one hour, based on the first 149,172 source rows scanned in 241 seconds, then five-minute resumable slices.
- Awards source snapshots: about 5–20 minutes of active crawling, potentially several hourly slices if responses or database writes are slow. Verified catalog links follow the independent identity queue, typically hours rather than minutes.
- Popular character portraits: start appearing with the first batches. The entire eligible catalog and identity backlog: provisionally **two to three weeks** at the conservative observed matched-title rate. This is an initial-pass estimate, not a promise that TVDB has an image for every role.

Check queue totals, source scan checkpoints and the `run:titles`, `run:mappings`, `run:awards`, and `run:seed` records in `tvdb_state`. Re-estimate after a full day using `tvdb_runs`, accounting for schedule duty cycle and unfinished mapping/publication work; a small benchmark cannot establish a precise completion date.

## Validation

Offline tests: `python -m unittest discover -s goodwatch-flows/tests -p test_tvdb.py`.

The tests exercise external identity mismatches, malformed/partial snapshots, pagination checkpoints, lease recovery, shared rate limits, missing award recipients, apparent duplicates, failed publication replay, concurrent source revisions and resumable catalog seeding. Run the existing sync state, stale child-row and deleted-title tests when changing shared schemas or publication behavior.

The existing deleted-title ownership test currently fails on the three social tables (`social_title_link`, `social_relevance`, `social_link_report`). This identical failure was reproduced with the unchanged `origin/main` schema and deletion helper. TVDB tables are covered by the deletion registry; the remaining social ownership discrepancy is outside this change.

## Invalid ID recovery and publication isolation

TMDB join IDs are positive signed 32-bit integers, matching our catalog columns. TVDB source IDs have a separate positive signed 64-bit contract. Booleans, non-ASCII digit strings, fractions, and oversized values are rejected. Invalid optional local joins become NULL; portraits, role names and original `remote_ids` remain intact. `mapping_error` and `rejected_tmdb_id` make this visible in MongoDB.

The publisher applies the same contracts to saved legacy mappings and validates complete scopes before writes. A deterministic bad-data scope remains pending with `publish_error`, `publish_failures`, and a retry time (15 minutes, then exponential backoff up to six hours). It is not acknowledged or reconciled. Healthy scopes continue; unexpected database row rejections are isolated by bisecting the batch. Infrastructure/schema failures remain visible in `run:publish` metrics and are not mislabeled as bad source records. The awards table is attempted even if character publication fails.

Crawler publication callbacks record errors without losing successful fetch metrics or aborting further crawling. The dedicated publisher records partial success before failing visibly when necessary. Publication progress is tracked independently per source table. `f/tvdb/health` runs every 15 minutes and feeds the existing enabled `f/monitoring/failing_schedules` monitor, which checks every ten minutes and alerts after three consecutive failing runs. Quarantined scopes remain visible to health checks between retry times.

Run `f/tvdb/repair` with `dry_run: true` to preview invalid saved joins, then `dry_run: false` to clear only their normalized IDs, keep an audit in `tvdb_repairs`, and mark affected source snapshots for replay. It performs no TVDB requests. Repeated execution is idempotent. Then run `f/tvdb/publish`; no catalog-wide recrawl is needed.

The 2026-11-06 incident was one saved actor mapping (`person:9088514`) with TMDB ID `29028252902825`. Its value exceeds the local INTEGER contract. The original source fields are retained so a later upstream correction can restore a verified link.

Recovery regression tests: `python -m unittest discover -s goodwatch-flows/tests -p 'test_tvdb*.py'`.

## Primary actor photos and default selection

All actors in a verified cast snapshot now enter the globally deduplicated person queue, including actors with no character portrait. The person API's `image` is stored as `tvdb_entities.image_url`, independently from a role's `image`. Existing `characters.personImgURL` values seed primary actor-photo candidates without another API request. A candidate never overwrites a canonical person-API observation, including an explicit absence.

`actor_photos` publishes the validated primary URL into `person.tvdb_profile_url`, alongside `tvdb_id` and its observation timestamp. It never writes `person.profile_path`: TMDB still owns that original fallback. An older observation cannot replace a newer primary photo; one duplicate TVDB identity with no photo cannot clear a photo owned by another identity. Missing local people stay pending with an hourly retry until the TMDB catalog supplies them. Unmapped or invalid external IDs remain unlinked.

Production person, cast, search, discovery, profile-statistics and MCP readers use the shared `PERSON_PHOTO_COLUMN`: the primary TVDB actor URL when nonempty, otherwise the TMDB profile path. Person/title/cast cache versions change with the rollout so older TMDB-only responses are refreshed. Newly populated photos subsequently follow the normal data-cache refresh intervals. Image helpers pass TVDB URLs directly to its CDN, without inventing TMDB size variants; MCP's image allowlist and CSP also permit that CDN for actor portraits. Character-specific images are not used as generic actor headshots.

The 2026-11-06 actor-photo backfill reuses stored TVDB cast data and runs independently of title crawling. Actor-photo publication has its own lease and progress/health monitoring. The app uses TMDB when no usable primary TVDB URL has been published. As with other external images, the source URL is fetched by the browser rather than downloaded into the pipeline's metadata stores.

## Award relationships and verified title links

Nominations expose `tvdb_person_id`, `person_tmdb_id`, `tvdb_character_id`, and `credit_id`, with independent `title_link_status`, `actor_link_status`, and `character_link_status`. These describe relationships, not whether a nominee won (`is_winner` remains the source's result).

A title link requires an explicit TVDB movie/show identity, a consistent saved TMDB remote ID, a non-deleted TMDB source document, and a matching movie/show row in CrateDB. Available IMDb IDs, the show's TVDB external ID and the already verified cast-title identity must agree. Movie and show IDs are separate namespaces. Explicit character or episode parent IDs may supply an absent title identity, but conflicting parents are rejected. Missing local titles and unresolved mappings remain source records with a null `media_tmdb_id`.

Actor links require explicit TVDB person evidence on the nomination's character, or on that same character ID in the verified title's cast. The character's parent and actor identities must agree; the actor's saved TMDB remote ID and a live local `person` row are required. `credit_id` additionally requires one exact actor/character match in that title's TMDB cast. Names, cast order, category names, and the fact that someone appears in a nominated title never establish the award's recipient. An unverified source character ID is retained as evidence; consumers must require `character_link_status = 'verified'` when treating it as an attached portrayal.

`verified` means these identity checks passed. `missing_source_identity`, `invalid_source_identity`, `unmapped`, `missing_local_title`, `missing_local_person`, `unverified_title`, `unverified_character`, `unverified`, and `conflict` preserve the reason a relationship is unavailable. Dependency refreshes (including a mapping being cleared) mark affected award categories for publication again. The daily category sweep also reconciles catalog changes.

Apply additive columns with `f/tvdb/schema`, then run `f/tvdb/award_links` (`dry_run: true` previews; `false` marks saved categories for a versioned, idempotent replay), followed by the normal publisher. The replay retains the original source JSON and performs no external requests.

Live audit on 2026-11-06: all 24,539 category nominations supplied `character: null` and no recipient names. Person endpoint probes for Daniel Craig and Meryl Streep also returned `awards: null`. Consequently these snapshots cannot yield verified actor/character awards. The pipeline supports explicit future source relationships, but historical recipient enrichment needs an additional source; it must not attribute title-level nominations to every cast member. The title audit verified 24,026 nominations, withheld 85 conflicting identities, found 414 unmapped identities, and found 14 missing local titles. Counts change as mappings and catalog data refresh.

## Award quality and display contract

A successful import is not a completeness claim. Use `tvdb_award_display` for title-level observations; do not count raw `tvdb_nomination` rows as award wins or nominations. The view groups verified, valid-year observations by title, award, category and ceremony year. `has_win` and `has_nomination` are independent signals: the same title can have both in a category. `source_row_count` describes source evidence, not a number of awards. Grouping does not delete or declare any source rows duplicates and is unsuitable for counting actor/recipient awards.

Every display observation has `coverage_status = 'partial'` and `totals_available = false`. Present an individual reported category/year result with source attribution and incomplete-coverage context; never label a title "Won N Oscars", "zero nominations", or derive complete historical totals from this feed. Dense recent data is not independent proof of completeness. Definitive counts require a separately verified, authoritative award/category/year dataset.

Title details read only this view, scoped by media type and TMDB ID, during the shared cache fill. Movie cache `details-movie-v8` and show cache `details-show-v9` carry the bounded summary (`awards`) and every reported result (`award_results`, uncapped; the view holds at most about 100 rows per title). The optional query has a 200 ms budget and fails to an omitted awards field; a title whose award read was late is cached all the same but stays fresh for 10 minutes instead of 12 hours (`DETAILS_AWARDS_LATE_MINUTES`), so one background refresh reads it again, awards included, without a second Crate round trip per request. The search role's repository grants include `DQL ON SCHEMA doc`, covering the view; no additional raw-source reader is used. Movie/TVSeries JSON-LD lists up to 20 reported wins. The title page's meta row ends with a trophy link "N awards" counting the title's reported wins (the owner's one exception to "no totals", 2026-11-06; no link without a win), and At a glance's Awards row lists every result by body. MCP `get_title` supplies source and incomplete-coverage context with up to 25 wins and 25 nominations, using `truncated: true` when either list is capped. A row reporting both outcomes is presented as a win. No observations means omission, never a claim of no awards.

Poster cards, best-of rows and the quick view read the whole view once per webapp process (one SELECT of about 22,000 rows, refreshed every 6 hours; a failed read keeps the previous index) into memory (`app/server/award-marks.server.ts`; rules in `app/domain/award-marks.ts`). A card or a best-of row names only the most notable body with a reported win ("Oscar winner"); the quick view lists up to three of the title's most notable results, wins or, without a win, nominations. Best-of loader data carries the listed winners' marks; cards read every mark from `/api/award-marks` (about 6 KB gzipped, loaded once per browser session, HTTP-cached); the quick view asks `/api/title-awards` for the title it shows. The owner ruled on 2026-11-06 that the UI shows no source or coverage line; the rules against totals, counts, person attribution and output for titles without rows still apply. MCP keeps its partial-coverage note.

Discover's awards filter (`awards=won|nominated[:bodies]`, Watch > Awards; `app/domain/award-filter.ts`) reads the same view on the page instances: one `GROUP BY media_type, media_tmdb_id` set per filter value (wins add `has_win`; bodies bind `award_name IN (...)`, pushed down to `tvdb_nomination`), cached in Redis for 30 minutes as `title-filter:v2:awards:*` and applied in memory like the other title-key sets. It keeps titles with a reported result and shows no counts of awards or source notes in the UI.

The source table retains original years, notes and nominee IDs. `ceremony_year_valid` accepts ASCII four-digit years from 1888 through the current UTC year; malformed and future values receive `invalid_ceremony_year` and are excluded from display. Daily publication re-evaluates the current year. `quality_flags` also marks incomplete coverage, apparent duplicates (equal evidence signatures within a category), and unreviewed details. Free-text details are absent from the display view, including plausible notes: there is no automated editorial approval based on a small blacklist.

Apply the additive schema/view migration before deploying the publisher. `f/tvdb/award_links` version 2 replays existing categories to populate quality annotations without re-crawling TVDB. Wait for pre-deployment workers to finish, then replay, so an old publisher cannot acknowledge an unannotated source revision.

2026-11-06 reviewer audit reproduced 1,023 duplicate-looking groups and five invalid-year records (`2027`, `202`, `200`). BAFTA 2025 had only 34 source rows. Academy Best Motion Picture category 64 had 125 rows with extensive gaps; the claim that all years 1964–2024 were absent has two exceptions, 2004 and 2017. Oppenheimer's missing Best Picture record illustrates why TVDB-only totals are unsafe; the [Academy's 2024 ceremony results](https://www.oscars.org/oscars/ceremonies/2024) identify it as the Best Picture winner. These are source coverage defects, not pending crawl work. The display safeguards do not fill those missing records.
