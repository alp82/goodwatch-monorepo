# Member list exposures (#525)

The owner applies [schema.sql](schema.sql) to production Crate before deploying the webapp.
`f/sync/models/crate_schemas.py` holds the same table for fresh installs. The app never runs DDL.

Discover's server-rendered pages and results API each record one row per built page for a member. Watch next and
My movies record their returned hero, Then column, loaded tiers, and suggestions, in display order. Later requests
to `/api/watch-next/cards` record a separate row for each batch. Unloaded tiers and missing catalog titles are not
exposures. This records lists built by the server, rather than proof that a poster entered the viewport; the poster
impression endpoint remains separate.

`user_list_exposure` is immutable, keyed and routed by `(user_id, list_id)`. The first 30 returned cards are stored
as parallel `title_keys`, `positions`, and `taste_matches` arrays. Positions start at 1 within the page or batch;
matches are the integers shown on the cards, including NULL when unavailable. A title key is `1e12 + tmdb_id` for a
movie or `2e12 + tmdb_id` for a show. Join ratings using the member id and decoded media type / TMDB id.

Each row carries the actual sort and requested sort (including fallback), For you's requested/applied states,
all filter state, country, expanded saved services, taste key version, and ordering identity. Watch next has no
For you switch, so both fields are false. Its `filters.type` distinguishes My movies. Discover has a page number;
Watch next has a `batch` of `page` or `cards`. Empty pages also record their state.

Personal order serves every eligible member's catalogue Best match and Watch next lists (#654/#655).
`ordering` records `personal-order` when used, or `taste-v2` on safe fallback. There is no rollout switch or
preview allowlist. The historical `personal_order_flag_mode` column stays `on` for new member rows;
`ordering_flags` is empty. Old off/shadow/preview rows remain unchanged. The nullable personal order fields record
fallback reason, payload build time, model hash and snapshot version; `personal_order_groups`,
`personal_order_mix_placed`, and `watch_next_tiers` align to the returned cards. Under personal order,
`today_first_100` records the same-list taste-order control before paging. The former shadow-only
`personal_order_first_100` column stays null for new rows. Historical migration instructions are in
[rename and deploy order](../personal-order-rename.md).
Ordering identity stays separate from the displayed card taste version.

The server returns `listId` immediately and schedules the Crate write on the next event-loop turn, without waiting.
Errors are logged. At 1,000 outstanding writes, further records are dropped and logged; the list still succeeds.
Normal Crate timeouts apply. A returned id is not a durability guarantee. Guests get `listId: null` and no write.
No consent-dependent browser telemetry or extra first-view request is involved.

Only a deployed production process writes exposures: `NODE_ENV=production` and a full 40-character hexadecimal
`SOURCE_COMMIT` are both required. Coolify already supplies the commit at runtime. No new Coolify value or
feature switch is needed. Local `npm start` without that deployment marker returns `listId: null`, as do dev
and test processes. Do not copy the deployment marker into local environments. Tests explicitly supply a
synthetic commit with an in-memory Crate client.

Known historical contamination (October 16, 2026): 55 Watch next Best match rows have
`personal_order_flag_mode='off'`, `ordering='taste-v2'`, `batch='page'`, and timestamps from
`2026-10-16T22:11:15.641Z` through `2026-10-16T22:24:35.945Z` inclusive. Their `filters` objects contain
`styles`, `themes`, and `taste`, which the deployed app did not emit until the subsequent picker deployment
at 22:28–22:29 UTC. Fetch that bounded selection and verify those object keys to identify the contaminated
rows without member identifiers. Exclude these from production rollout measurements; retain the immutable
rows. This identifies the known sample, not every possible historical non-production write.


Follow-up: carry `listId` and page/batch position through title opens, Want to See, Not interested, and ratings, and
persist that attribution. The shared card actions, Watch next's hero/suggestions, and subsequent title-page actions
use different mutation paths today; this build leaves those paths for a separate change. For now,
ratings are joinable by member and title/time, but a specific action cannot be attributed to a specific list id.
After a month, follow up with the randomized slot and its probability from #525.

Validation (October 14, 2026): the exposure writer/list builder tests, Discover filter cache, title filters,
taste, My pages, Watch next, For you, filter state, and Crate insert rows tests pass (10 Node test files).
The two offline schema tests pass. Tests ran serially after checking available memory, using fake backends.
`npm run typecheck` reports 174 existing diagnostics: comparing with starting commit
`ad7e6d1905706a565ab0f2635da3b9af32e877a8` using the same dependencies finds no added or removed diagnostic
(ignoring line/column shifts), and no diagnostic in a changed file. Full typecheck remains failing on that baseline.
