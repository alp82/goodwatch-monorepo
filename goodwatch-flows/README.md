# GoodWatch Flows

Collect and process all necessary data for movies and tv shows.

Application Postgres retirement and deployment order are documented in
[the migration runbook](../docs/postgres-retirement.md). Legacy pipelines are
preserved under `retired/`, outside the Windmill deployment directory.

## Getting Started

System requirements:
* python >= 3.10
* [pdm](https://pdm.fming.dev/)
* `docker` and `docker-compose`
* optional: [pyenv](https://github.com/pyenv/pyenv) (recommended)

Install dependencies:
```
pdm install
```

## TODO
* install deno
* `deno install --unstable -A https://deno.land/x/wmill/main.ts`

* `wmill workspace add flickvibe flickvibe http://coinmatica.net:9000`
* `cd goodwatch-flows/windmill`
* `wmill sync pull --json --yes`

* `wmill sync push --json --yes`

## IDE Setup

### PyCharm

1. set `/goodwatch-flows/windmill` as sources root
2. choose python interpreter from existing venv in `goodwatch-flows/windmill/.venv/bin/python`
3. update python run configuration template:

```
BASE_INTERNAL_URL = https://app.windmill.dev
WM_TOKEN = ThisIsAToken
WM_WORKSPACE= workspace_id
```

## Automatic workspace deployment

Pushes to `main` that change `goodwatch-flows/**` automatically sync this folder
to the `goodwatch` Windmill workspace. The workflow can also be run manually from
GitHub's Actions page.

The repository must have:

- a `WMILL_URL` Actions secret containing the publicly reachable Windmill URL
- a `WMILL_TOKEN` Actions secret containing a Windmill user token with permission
  to sync the workspace

## Daily buzz score

`f/buzz/daily.flow` collects Wikipedia pageviews for balanced movie/show
candidates and publishes a shared top-20 snapshot in new Crate `buzz_*` tables.
It backfills 60 complete UTC days and never accesses Valkey. The table contract,
local production driver and post-merge schedule are documented in
[buzz-score.md](../docs/implementation/talked-about-now/buzz-score.md).

Run its offline behavior tests:

```sh
python -m pip install -r tests/requirements-buzz.txt
python -m unittest discover -s tests -p 'test_buzz.py'
```

## DNA generation tests

Run without live HTTP requests, credentials, or MongoDB:

```sh
python -m venv /tmp/goodwatch-dna-tests
/tmp/goodwatch-dna-tests/bin/pip install -r tests/requirements-dna.txt
/tmp/goodwatch-dna-tests/bin/python -m unittest discover -s tests -p 'test_dna_*.py'
```

These tests include the checked-in `f/dna/generate_dna` and nested
`f/dna/crawl_all_by_id` wiring with fake HTTP, Redis, and MongoDB services.
The local driver resolves their dotted input expressions and runs loop iterations
sequentially; it does not emulate the Windmill runtime or its parallel scheduler.
Real Windmill validation remains part of
[Run the acceptance criteria on the ten benchmark titles](https://github.com/alp82/goodwatch-monorepo/issues/39).

### Spend pause

DNA selection and fetch jobs share the Redis key `dna:openrouter:spend_pause`.
An OpenRouter 402 pauses generation until the next UTC midnight. An explicit
monthly-budget exhaustion message in a 403 pauses it until the first of the next
month at UTC midnight, matching the provisioned monthly guardrail. This includes
error codes embedded in HTTP 200 responses. The monthly classifier requires both
`monthly` and `budget ... exceeded`, `budget ... exhausted`, or `budget ... reached`
in the top-level error message. Unknown 403s continue to fail visibly, including
budget errors that do not name the supported interval.

[OpenRouter documents budget and access rejections as 403](https://openrouter.ai/docs/guides/features/guardrails/overview),
but does not specify a stable guardrail budget-error message schema there.
The classifier therefore needs checking against the actual guardrail response
during acceptance; it must not treat every 403 as a spending limit.

Concurrent workers check the key before every generation request, including
repairs and retries. Requests already in flight can finish. A shorter pause cannot
overwrite a longer one. Unprocessed titles have `is_selected` and `selected_at`
cleared; completed DNA continues through local fingerprint persistence. Runs starting while paused
return zero fingerprints without accessing MongoDB or the inference service.

The key expires automatically. If the owner changes the provider budget before
the deadline, deleting this key from the configured Redis cluster allows selection
to resume. Redis errors remain visible rather than permitting unguarded inference.

## Social discovery

`f/social/discover` and `f/social/deletion_sync` collect and match YouTube, RSS,
Bluesky and Mastodon content in new Crate tables. See the
[store/API contract and operations guide](../docs/implementation/talked-about-now/social.md)
for local backfills, the content-quality gate, tests, deletion/opt-out handling
and post-merge schedules. Re-screen existing rows with
`scripts/social_quality.py` (read-only preview by default, `--apply` unpublishes
failures). Title reads must require a current passing quality verdict.

## Availability history

The streaming publisher records a stay for each title/country/service offer of
`flatrate`, `free`, or `ads`; exact days require consecutive fresh title reads or
a matching original premiere within seven days. See the
[rollout and test report](../docs/implementation/availability-history/README.md)
and [owner-applied DDL](../docs/implementation/availability-history/ddl.sql).

`scripts/backfill_availability_history.py` defaults to a SELECT-only count/size
preview. `--apply` fills the baseline in six groups and verifies counts;
`--reconcile` previews drift and `--reconcile --apply` repairs it with unknown
precision. Pause `f/sync/copy/tmdb_streaming`, `f/priority/crawl_all`,
`f/sync/copy/tmdb_details`, and `f/sync/copy/orphaned_titles`, and wait for active
jobs before applying. Finish the baseline before pushing to
main, because that push deploys the writer. See the report for the full sequence.

The [daily service-list job](../docs/implementation/daily-provider-lists/README.md)
adds scoped daily evidence to that same history writer. It defaults to a preview with only an operational Mongo run lease, monitors the research's big brands in every country, and never writes
current offers. Its new schedule is an owner-applied proposal after review.
