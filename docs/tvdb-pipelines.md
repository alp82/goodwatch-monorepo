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

One shared API budget caps requests across all jobs at four per second. HTTP 429 establishes a shared cooldown honoring Retry-After; 401 refreshes authentication once, persistent 401/403 fails visibly, and network/server failures preserve successful snapshots. Leases recover work left by a terminated worker. The title reconciliation interval is 30 days; actor/title identity mappings refresh after 180 days or relevant update events.

## Storage and identities

MongoDB holds `tvdb_titles`, `tvdb_entities`, `tvdb_awards`, `tvdb_categories`, queue/checkpoint state in `tvdb_state`, and 30 days of successful worker metrics in `tvdb_runs`.

CrateDB has two source-owned tables, registered in `f/sync/models/crate_schemas.py`:

- `tvdb_character`: title + TVDB role identity, actor identities, role name, character and actor image URLs. `credit_id` is populated only for a unique actor/character match against our TMDB cast credits. Unmapped and ambiguous roles remain available separately.
- `tvdb_nomination`: source nominee identity within its category, ceremony year, winner status, recipient/context when available, verified local title links, and original nominee JSON. Unmatched nominations are retained.

`dedupe_key` groups apparently identical source records for review. It is not proof of a duplicate: missing recipients can make legitimate co-nominees indistinguishable. Never collapse source records or claim definitive award totals solely using this key. Unknown award coverage does not mean zero nominations. Never substitute an actor's name for an absent award recipient.

Each successful source snapshot marks publication pending. Publishing batches upserts before one table refresh and scope reconciliation, then acknowledges the exact source revision. Failed writes or source revisions arriving during publication remain pending. A global publication lease prevents an older publisher from deleting newer rows. TMDB cast replacement does not own either TVDB table. Both are registered for catalog title deletion; source nominations remain in MongoDB and can be republished with an unknown local link on the next category sweep. Source catalog removals are published as empty character snapshots when seen by the seed job.

Character images are stored as external URLs; this pipeline does not download all image binaries. These are portrayals within titles, not a global fictional-character identity or biography. Application UI integration is separate.

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
