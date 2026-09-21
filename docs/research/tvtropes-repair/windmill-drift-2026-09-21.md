# Windmill drift audit: origin/main vs live `goodwatch` workspace, 21 September 2026

Read-only audit. Compared `origin/main` at `775ba0f` (`goodwatch-flows/windmill`) with the production workspace `goodwatch` (internal address), captured about 07:54 UTC. Only GET requests were issued (`scripts/list`, `scripts/get/p`, `flows/list`, `flows/get`, `schedules/list`, `apps/list`, `apps/get/p`, `folders/list`, `resources/list`, `variables/list`, `resources/type/list`; variable and resource values were discarded unread). The `wmill` CLI was **not** run, not even as a dry run; this is an API-based reconstruction of what `sync push` would see.

## Summary

- Live: 125 scripts, 26 flows, 27 schedules, 1 app, 28 folders. Repo: 123 script metadata files, 26 flows, 0 schedules, 1 app, 25 folders.
- **No script or flow source content differs.** All 26 flows (including inline scripts and inline locks) match. The three scripts deployed by API during PR #124 (`title_variations`, `tvtropes_init_tags/main`, `tv_tropes_crawl_tags/fetch`) match main byte for byte in content; main/fetch also match in lock.
- **No repo script is absent live any more.** The "two repository scripts absent live" finding from the partial PR #124 comparison no longer holds (e.g. `f/data_source/title_identity` and `f/tvtropes_web/title_variations` are both live).
- 10 scripts would be changed by a push: 7 lock differences where **the repo lock is older than live** (a push would downgrade pins), 3 of them with an empty repo lock, plus 2 probable metadata-only false positives.
- 2 live scripts have source in main but no `.script.yaml`; the CLI's handling of those is uncertain.
- Schedules are in sync scope but none are in the repo; with `--keep-deleted` they are left untouched.

## 1. Items a sync push from origin/main would create or change

Live timestamps are the `created_at` of the current live script version (UTC); git dates are the last commit on origin/main touching the file.

| # | Path | Kind | Diff summary (live -> repo) | Live version | Repo file | Newer |
|---|---|---|---|---|---|---|
| 1 | `f/tmdb_api/tmdb_fetch_details_from_api/fetch` | lock | py 3.12 -> **3.11**; wmill 1.815.0 -> 1.589.1; pymongo 4.18.1 -> 4.15.5; mongoengine 0.29.3 -> 0.29.1; pydantic 2.13.5 -> 2.12.5; pydantic-core 2.46.5 -> 2.41.5; requests 2.34.2 -> 2.32.5; urllib3 2.8.0 -> 2.5.0; certifi, anyio, idna, charset-normalizer, annotated-types, typing-* also down | 2026-09-19 06:54 | content 2026-09-19 (`7322e55`), lock 2025-12-31 (`3a4a32b`) | live lock |
| 2 | `f/tvtropes_web/tvtropes_init_tags/update` | lock | py 3.12 -> **3.11**; wmill 1.815.0 -> 1.589.1; pymongo 4.18.1 -> 4.15.5; mongoengine 0.29.3 -> 0.29.1; pydantic 2.13.5 -> 2.12.5; pydantic-core 2.46.5 -> 2.41.5; anyio, certifi, idna, annotated-types, typing-* down | 2026-09-21 07:06:31 (automatic dependency re-lock right after the PR #124 API deploy; content unchanged) | content 2024-05-09, lock 2025-12-31 | live lock |
| 3 | `f/priority/publish` | lock | crate 2.3.0 -> 2.2.1; grpcio 1.84.0 -> 1.83.1; protobuf 7.36.2 -> 7.36.1; pymongo 4.18.1 -> 4.18.0; urllib3 2.8.0 -> 2.7.0; idna 3.20 -> 3.19; wmill 1.815.0 -> 1.808.0 | 2026-09-19 06:55 | content 2026-09-11, lock 2026-09-09 | live lock |
| 4 | `f/sync/copy/vector_data` | lock | same seven package changes as #3 | 2026-09-19 06:55 | content 2026-09-14, lock 2026-09-11 | live lock |
| 5 | `f/sync/copy/tmdb_streaming` | lock | crate 2.3.0 -> 2.2.1; pymongo 4.18.1 -> 4.18.0; urllib3 2.8.0 -> 2.7.0; idna 3.20 -> 3.19; wmill 1.815.0 -> 1.808.0 | 2026-09-19 06:54 | content 2026-09-19, lock 2026-09-09 | live lock |
| 6 | `f/sync/availability_evidence` | lock (no lock file in repo; yaml has `lock: ""`) | live `# py: 3.12` -> empty; server regenerates the lock | 2026-09-19 06:54 | 2026-09-19 (`7322e55`) | same day; equivalent |
| 7 | `f/tmdb_api/provider_evidence` | lock (as #6) | live `# py: 3.12` -> empty | 2026-09-19 06:54 | 2026-09-19 (`7322e55`) | equivalent |
| 8 | `f/tvtropes_web/title_variations` | lock + metadata | lock: live `# py: 3.12` -> empty 0-byte file. Metadata: summary live empty -> "TV Tropes title candidates"; description live "Generate conservative TV Tropes work URL candidates" -> "Generate source-specific slugs without changing application slug rules" | 2026-09-21 07:06:01 (hash `4ac10ba83c6986f3`) | 2026-09-21 09:11 +02 (`775ba0f`) | repo metadata (few minutes newer) |
| 9 | `f/db/milvus` | metadata (probable false positive) | repo yaml has `no_main_func: true`; API returns `null` | 2025-10-21 | 2025-12-31 | n/a |
| 10 | `f/sync/models/milvus_schemas` | metadata (probable false positive) | as #9 | 2026-09-14 21:06 | 2026-09-14 22:41 +02 | n/a |
| 11 | `f/dna/prototype_comparison/jev_run` | metadata absent in repo | `.py` exists in main and equals live content, but there is no `.script.yaml` or lock. Live: empty summary, empty schema, lock `# py: 3.12` | 2026-09-17 22:06 | `.py` only | n/a |
| 12 | `f/dna/prototype_comparison/jev_report` | metadata absent in repo | as #11 | 2026-09-17 22:06 | `.py` only | n/a |

Note on "the five unrelated lock differences" from PR #124: they are rows 1-5. None of them changes the Milvus client itself; `pymilvus` pins are identical in repo and live for every script. The Milvus-related scripts (`publish`, `vector_data`) differ only in transitive gRPC/protobuf patch versions and in crate/pymongo/urllib3/wmill.

Not changed by a push:

- Flows: all 26 identical (summary, description, value, schema, inline code and locks).
- App `f/apps/stats`: summary and value identical. The repo file has no `policy` while live does; the CLI normally regenerates policy on push, so the app may still be listed as changed, without functional effect.
- Folders: the 25 repo `folder.meta.yaml` files match live on summary, display_name, owners, extra_perms. Live-only folders `combine_data`, `genome`, `user` are kept (`--keep-deleted`).
- Schedules, resources, variables: see section 3.
- Resource type `c_weaviate`: exists both live and in repo, but is skipped (`skipResourceTypes: true` and `--skip-resource-types`).
- No live script lives outside `f/`.

## 2. Recommendations

| # | Path | Recommendation | Reasoning |
|---|---|---|---|
| 1 | `tmdb_fetch_details_from_api/fetch` | **pull live version into repo** | A push would move a script whose content was last deployed on 19 Sept under Python 3.12 back to a December 2025 lock on Python 3.11 with wmill 1.589 and pymongo 4.15. The live lock is what the current content has actually been running with; the repo lock was never exercised with it. Its schedule is currently disabled, but it is also reachable through `f/priority/crawl_all`, which runs every 20 seconds. |
| 2 | `tvtropes_init_tags/update` | **pull live version into repo** | Same downgrade. It runs in the daily 02:00 initializer and in `f/priority/crawl_all` (every 20 seconds); the initializer which already has an intermittent Mongo socket timeout; changing the pymongo/mongoengine versions underneath it now would confuse that diagnosis. The live lock was produced by Windmill itself on 21 Sept. |
| 3 | `priority/publish` | **pull live version into repo** | Patch-level downgrades only, low runtime risk either way, but live is two days old and running on the every-20-seconds priority path; the repo lock is simply stale. grpcio/protobuf stay within the same minor, pymilvus unchanged. |
| 4 | `sync/copy/vector_data` | **pull live version into repo** | As #3. This is the Milvus/vector writer (every 4 hours); keep the gRPC/protobuf pair that has been working live. |
| 5 | `sync/copy/tmdb_streaming` | **pull live version into repo** | As #3, no gRPC involved; crate 2.3.0 -> 2.2.1 is the only client-facing change. |
| 6, 7 | `availability_evidence`, `provider_evidence` | **accept repo version**, optionally commit a lock file containing `# py: 3.12` to stop the perpetual diff | Dependency-free helper modules. A push with an empty lock makes the server regenerate the same one-line lock. Side effect: a new version of a shared module can trigger automatic re-locking of scripts that import it, which is how row 2 drifted. See the caveat below. |
| 8 | `title_variations` | **accept repo version** (metadata), and commit `# py: 3.12` as the lock | Summary/description only; content is identical to the reviewed deploy. Same re-lock side effect as rows 6-7: pushing a new version of this helper may re-lock `tvtropes_init_tags/main` and `tv_tropes_crawl_tags/fetch`, moving their live locks away from the repo. |
| 9, 10 | `db/milvus`, `models/milvus_schemas` | **accept repo version** | Both are import-only modules without `main`, so `no_main_func: true` is correct. Content and lock are identical (pymilvus 2.6.2 unchanged). Worst case is a no-op new version. `f/db/milvus` is imported widely, so a new version could again trigger dependent re-locks. |
| 11, 12 | `jev_run`, `jev_report` | **needs owner decision** | Prototype scripts whose source is in main without metadata. Either generate and commit `.script.yaml` + lock (pull live), or remove the `.py` files from `f/` if they are not meant to be deployed. Whether CLI 1.803.0 ignores, errors on, or auto-creates metadata for a bare `.py` was not verified. |

Practical route to a safe push: run `wmill sync pull` for rows 1-5 (locks only) and rows 6-8, 11-12 (lock/metadata files) into a branch, review that the diff contains lock and metadata files only, merge with a `[WM]`-prefixed commit message or accept that the resulting push is a no-op. After that, a normal push from main changes nothing of substance.

Caveat on dependent re-locking: Windmill re-resolves locks of scripts that import a changed workspace module. Any push that creates new versions of shared helpers (rows 6-10) can therefore produce fresh live locks for their importers, recreating lock drift immediately after the push. Expect to pull once more after the first clean push, or pin the versions in script requirements.

## 3. Schedules

- `wmill.yaml` has `includes: ["f/**"]`, `excludes: []`, and no `skipSchedules`/`includeSchedules` key. The workflow passes skip flags only for variables, secrets, resources and resource types. Schedules are therefore not explicitly excluded. Depending on the CLI default for 1.803.0 they are either in scope or ignored; this was not verified from `--help`.
- The repo contains **zero** `*.schedule.yaml` files. All 27 live schedules are absent from the repo.
- Because the push uses `--keep-deleted`, live-only schedules are not removed and not modified. A push from main does not touch any schedule. Removing `--keep-deleted` while schedules are in scope would delete all 27, which should be guarded against.
- The live TV Tropes crawler schedule `f/tvtropes_web/tvtropes_crawl_tags` (`16/20 * * * * *`, Europe/Berlin, enabled, flow `f/tvtropes_web/tvtropes_crawl_tags`, last edited 2024-02-12) is **not represented in the repo**. The same is true for `f/tvtropes_web/tvtropes_init_ratings` (`0 0 2 * * *`) and `f/sync/copy/tvtropes` (`0 0 3/6 * * *`).
- Two live schedules are disabled: `f/rotten_web/rotten_tomatoes_crawl_ratings` and `f/tmdb_api/tmdb_fetch_details_from_api`.
- Resources (4 live) and variables (25 live, 2 under `f/`) are excluded by both `wmill.yaml` and the workflow flags; none are in the repo. Not part of the push.

## 4. Limits of this audit

- The CLI was not run. The list is derived from comparing API responses with repo files, not from the CLI's own diff. The CLI normalises metadata (key order, defaults, `policy`, `no_main_func`, schema formatting) in ways not reproduced here, so it may report extra cosmetic changes, or fewer (rows 9-10).
- Script metadata compared: summary, description, kind, schema, and the common runtime fields (tag, timeouts, concurrency, cache, priority, dedicated worker, envs and similar), with null/empty/false treated as equal. Permissions (`extra_perms`) on scripts and flows were not compared. Flow comparison covered summary, description, value and schema, not flow-level settings outside `value` such as `tag`, `ws_error_handler_muted`, `dedicated_worker`.
- `wmill-lock.yaml` hashes in the repo were not checked for consistency with the files; stale entries can make the CLI regenerate metadata locally in other commands, but `sync push` does not depend on them.
- Whether Windmill accepts a pushed lock verbatim or re-resolves it was not tested. The assumption is that a non-empty lock is stored as given and an empty one triggers resolution.
- Triggers other than cron schedules (HTTP routes, websocket, Kafka, Postgres, etc.), users, groups, workspace settings and encryption key were not listed.
- "Who is newer" uses the live version's `created_at` against the git commit date. A live version timestamp reflects the last deploy or automatic re-lock, not necessarily a human edit; all live versions are attributed to user `Alp`, including the API deploys and the automatic re-lock in row 2.
- Snapshot in time. The workspace has crawlers running every 20 seconds and had deploys earlier today; any deploy after 07:54 UTC is not reflected. Re-run the comparison immediately before the push that is meant to be the first clean one.
- Archived scripts and script version history were not examined.
