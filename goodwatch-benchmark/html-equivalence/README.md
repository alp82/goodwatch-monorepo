# Document HTML equivalence

The merge gate for [#753](https://github.com/alp82/goodwatch-monorepo/issues/753).
It compares complete document responses before any browser JavaScript runs.
A first load must keep its visible content and its serialized loader data.

Run commands from this directory. No dependencies are added or installed.
The runner uses Node.js, Git, `ss`, `diff`, Docker, and the webapp's existing
`happy-dom` development dependency. The local bench Crate and title snapshot
must already be running at `127.0.0.1:15870` and `127.0.0.1:15871`.

## Local merge gate

```sh
./run.sh local origin/main origin/main
./run.sh local origin/main my-candidate-commit
./run.sh local origin/main /absolute/path/to/candidate-worktree
```

The base is a git ref. The candidate can be a ref or an existing worktree,
including uncommitted changes. Do not edit a candidate while the gate runs.
An existing worktree keeps its build output. The runner removes only the
worktrees it created. Use distinct trees for the two builds.

For a ref, the runner creates a detached worktree under
`~/.cache/gw753-html-check/run-<time>-<pid>/`. To use another directory, set
`GW_HTML_CHECK_CACHE`. The worktree's `node_modules` is a real directory, with
one symlink per entry into `goodwatch-webapp/node_modules` of the checkout that
runs the gate. Install that checkout's dependencies first, and keep them
current: a stale install builds both refs with old packages.
It never runs an install. Builds run sequentially with `npm run build`.

Each build and server runs through `env -i` with an explicit allowlist.
The runner validates every configured endpoint as loopback and pins external
keys empty. It refuses dotenv files in the repository root and webapp,
except `.env.example`, because Vite and remix-serve can read dotenv files
independently of the inherited environment. It preloads
`/home/alp/dev/projects/goodwatch/goodwatch-tv-a-verify/bench2/block-egress.mjs`
for builds, servers, and their Node children. An outbound TCP connection is
blocked before it connects.

Each server uses the existing bench catalog and title snapshot, and a new
throwaway one-node Valkey 8 cluster with all 16,384 slots. The runner selects
free app, Valkey, and cluster bus ports using `ss` and socket binding checks.
It sets `STATIC_ASSETS=origin` and `PAGE_CACHE=off`. It follows the recipe in
`goodwatch-tv-a-verify/bench2/up.sh`; no front proxy is needed for HTML reads.
It performs only SELECT queries against the bench Crate. It does not copy,
drop, or recreate catalog data or title snapshots.

The URL list comes from the bench Crate:

- The first 30 movie IDs in ID order. Fewer than 30 is an error.
- Every show that renders. A 404 is excluded; any other failed probe aborts.
- Every person that renders, if there are person rows.
- `/`, `/movies`, `/shows`, both best lists, `/movies/moods/feel-good`,
  `/shows/moods/scary`, `/discover`, `/discover?q=Star%20Wars`, `/people`,
  `/about`, and an intentionally missing URL.

There is a safety limit of 999 show/person rows each. Hitting it requires an
explicit coverage review. The two mood pages avoid the external TMDB genre
lookup used by `/movies/genres` on a cold data cache.

Requests use Googlebot, Bingbot, and desktop Chrome user agents. All three
send document navigation headers and the same `Accept-Language`. There are
no cookies, credentials, or browser subresource requests. Redirects are
recorded and followed locally, including canonical title redirects. A redirect
to another service aborts. The local Host header is `goodwatch.app`, so the
two server ports cannot change canonical document URLs.

Before measuring, each server gets one Googlebot warmup pass. Discover's
first snapshot can return approximate filter counts while its worker prepares
exact counts. Warmup gives that worker time to finish; those values are still
compared exactly. Then each server is captured twice and compared against
itself. Either self-check failing aborts the gate. The second base and
candidate captures must then match.

A failed fetch, unexpected status, 5xx, incomplete HTML document, changed
status/redirect chain, `no-store` on only one side, or changed normalized body
exits nonzero. Both sides returning `no-store` is allowed, as requested by the
ticket. This proves equivalence to the base, not that the base's data is complete.

## Review reports

Local runs fetch every distinct `/assets/manifest-<hash>.js` referenced by the
measured documents on each build. `manifest-diff.json` records the referenced
assets, parsed route summaries, and a structured diff by route ID. It reports
added and removed routes and changes to `hasLoader`, `hasClientLoader`,
`hasAction`, `hasErrorBoundary`, and the module path with build hashes removed.
The console prints the same route changes and a count. This report is
informational: route changes and manifest fetch or parse errors never fail
the HTML gate by themselves. Errors are recorded explicitly, so a missing
report cannot be mistaken for unchanged routes. Fetched manifest sources stay
in the run directory. No fetched JavaScript is executed.

For a reviewed class-only change, supply one or more regexes:

```sh
./run.sh local origin/main my-candidate-commit --allow-class 'scroll-smooth' \
  --allow-class 'duration-[0-9]+'
./run.sh prod compare /path/to/base /path/to/candidate --allow-class 'scroll-smooth'
```

Each regex must match a whole class token. Matching tokens are removed from
both sides only inside double-quoted `class="..."` attributes before comparison.
Text, other attributes, comments, and script/style contents stay intact.
Removing tokens collapses whitespace within that class value; an empty
attribute stays present. Unmatched tokens such as `hidden`, `sr-only`, and
`invisible` still fail unless explicitly allowed. Without this option, class
attributes retain the existing byte-for-byte comparison. Invalid regexes fail
before builds or reads start. Quote regexes to prevent shell expansion.

`comparison-review.json` records the regex strings, total tokens removed per
side, counts for each URL/client, and empty loader lists shared by both sides.
The console prints the allowlist and per-side totals even when they are zero.
Local cross-build results live in the run directory; each self-check has its
own report in `base-2/` or `candidate-2/`. Production comparisons save the
report in the candidate snapshot directory.

Pages with an empty array as route loader data or an empty array immediately
inside a route's loader data are reported as "empty on both sides" when the
same route/field is empty in both documents. These informational entries name
the URL, client, and route/field. Nested arrays are not included. Matching
empty lists do not prove the bench covers populated production data.

## Normalization contract

HTML stays byte-for-byte comparable apart from these fields:

| Field | Reason |
| --- | --- |
| Eight-character hash in `/assets/<name>-<hash>.<ext>` | Vite and the related-map build use content hashes. The asset name, extension, and surrounding element remain. |
| Generated Remix route import/manifest module script contents | A build can change the module graph. Script attributes and presence remain. The start page's delayed import string is treated the same way; its scheduling code and preload array remain. |
| `nonce` attribute values | A CSP nonce identifies one response. The attribute itself remains. |
| `state.dataUpdatedAt` and `state.errorUpdatedAt` in dehydrated TanStack Query entries | These record the server render's query-cache clock. Query data, keys, errors, counts, and all other state remain. |

The runner parses `window.__remixContext` as JSON without evaluating code.
It supports direct JSON and `JSON.parse` serialization, and writes a canonical
JSON representation. All loaderData keys and values remain except the two
query-cache clock fields above. Future flags, errors, and other context fields
are compared. Current documents have no other build-only context fields.
Unsupported context serialization fails explicitly.

Catalog dates, release dates, score timestamps, request IDs, and arbitrary
numeric values are not stripped. The repeated runs needed no additional
request ID or date normalization. If a later build introduces request-specific
HTML, add a narrowly scoped rule with evidence and a regression test. Never
normalize away catalog changes or missing sections to make a gate pass.

Visible elements, links, metadata, JSON-LD, inline scripts outside the generated
Remix import block, and every `<link rel=...>` remain part of the comparison.
This checks the HTTP document, including its serialized data, without hydration.

## Production snapshots

```sh
./run.sh prod snapshot ~/.cache/gw753-html-check/prod-baseline
# After a deployment:
./run.sh prod snapshot ~/.cache/gw753-html-check/prod-after
./run.sh prod compare ~/.cache/gw753-html-check/prod-baseline \
  ~/.cache/gw753-html-check/prod-after
```

The snapshot directory must be empty or absent. The first run reads the live
sitemap index and movie, show, person, and category sitemaps. It samples their
URL ranges deterministically and adds the main entry routes and search. The
result is 60 fixed URLs, saved in `~/.cache/gw753-html-check/prod-urls.json`.
Later snapshots reuse that list. Keep it with the baseline when moving between
machines. Each snapshot's manifest also records its paths and clients.

Only anonymous HTTPS GETs to `https://goodwatch.app` are permitted. Production
uses Googlebot and browser requests, without Bingbot. All requests, including
sitemaps and redirects, share a limiter with at least 550 ms between request
starts, below two requests per second. No production server or database is
started or accessed.

Comparison checks identical URL/client sets and reports each changed URL:

- `STRUCTURE`: element counts within each landmark, section, article and ARIA
  role; loaderData key paths, including nested array object keys; and JSON-LD
  types and field shapes. Missing landmarks, sections, keys, or JSON-LD appear
  here. JSON-LD array length changes also appear here.
- `TEXT`: body text after removing script and style contents.
- The complete HTML diff also covers attribute and loader value changes that
  do not alter visible text or structure.

A comparison exits 1 when anything differs. These are review reports, not merge
gates: scores, availability, result counts, catalog membership, and even server
builds can change during or between captures. A structural change needs human
review and is not automatically proof of a rendering regression. Requests are
sequential, so a deployment during capture can produce a mixed-build snapshot.

## Artifacts and cleanup

Every capture saves raw and normalized `.html` files plus `snapshot.json`
(status, Cache-Control, redirect chain, URL and client). The manifest is saved
after each response. Interrupted or failed captures are marked incomplete and
cannot be compared. Local runs also retain
build/server logs, environment allowlists, source commits, working-tree status
and tracked diffs, and the chosen URL list. Each changed document has a
`diff-<index>/difference.diff` with the full diff. Console previews show the
first 60 lines and cap long lines at 700 characters. Full files are not truncated.
Production comparisons also save `structure.json` with both structures.
Comparisons re-normalize raw files with the current normalizer, so changes to
the tool do not require another production read.

On success, failure, SIGINT, or SIGTERM, the runner checks each owned PID's
command and working directory before stopping its process group. It removes
its Valkey containers and temporary ref worktrees. It never stops a service
that it did not start. SIGKILL and a machine crash cannot run cleanup; use the
recorded run directory and `gw-html-<pid>-<label>` container names to inspect
such an interrupted run. Artifacts stay in the cache for review and can be
removed after review.

## Verification on October 23, 2026

`origin/main` resolved to `01e079bcdb9be23a235a8762c9ea2275576f09e3`.
The bench contained 134 movies, 72 shows that rendered, 12 episodes, and no
people. No data was copied or changed by the checker.

```sh
./run.sh local origin/main origin/main
```

Passed: 114 URLs × 3 clients = 342 documents per measured capture. Both
self-checks and the cross-build gate reported **0 differences**. The two warmup
passes fetched 114 documents each, outside the measured comparisons.

For a negative experiment, a separate detached candidate worktree changed
only the movie route's final return from `return <Details ... />` to
`return typeof window === "undefined" ? null : <Details ... />`. Its loader
still ran, but its first-load title content disappeared. Running the same gate
against that worktree passed both self-checks and exited 1 with **90 document
differences**: all 30 movies for all three clients. The diffs showed the removed
title content. That deliberate breakage was never committed and the throwaway
worktree was removed.

```sh
cd ../../goodwatch-webapp
node --test ../goodwatch-benchmark/html-equivalence/core.test.mjs
npx biome check ../goodwatch-benchmark/html-equivalence/*.mjs
npm run typecheck
```

All 17 normalizer, review-report, and CLI tests pass. They cover lost sections, links, metadata,
JSON-LD, loader keys, query clocks, direct and encoded context JSON, generated
imports, statuses, and unsafe environment values. Typecheck has 188 existing
errors; running it on `origin/main` produced byte-identical output. No webapp
source or dependencies changed in this ticket.

The production baseline contains **60 URLs × 2 clients = 120 documents** at
`~/.cache/gw753-html-check/prod-baseline/`. Comparing it with itself reports
zero differences. No post-deployment comparison has been made. Local people
coverage is absent because the bench has no people. Qdrant is unavailable in
this bench, so related-map data can be absent on both sides; unchanged missing
data is not evidence that production content is complete. The production
baseline includes eight person pages and the normal live related sections.

## Follow-up verification on October 23, 2026

The manifest/class review follow-up ran `./run.sh local origin/main origin/main`
once against the same `01e079bcdb9be23a235a8762c9ea2275576f09e3` base.
Both self-checks and the cross-build comparison passed: 342 documents each,
zero HTML differences. The manifest report found zero route differences and
zero report errors. No class allowlist was supplied; zero tokens were removed
on either side. Twelve URL/client entries were empty on both sides: `/`,
the two mood pages, and `/people`, for all three clients. All 17 tests and
Biome checks pass. Typecheck reports the same 188 errors, byte-identical to
the saved origin/main check. Production was not read again for this follow-up.

## Check isolated profile fixtures

Set `GW_HTML_CHECK_CRATE_PORT` to use a dedicated Crate fixture on another
loopback port. The default remains `15870`; the catalog reads and both webapp
processes use the selected port. Set `GW_HTML_CHECK_EXTRA_PATHS` to a JSON array
of local paths to include, such as `["/u/benchprofile/stats"]`. These paths must
return 200. The runner rejects paths that resolve to another origin.

For the profile stats payload reduction, the strict gate reports the intended
loader differences. Verify those differences separately with:

```sh
node goodwatch-benchmark/profile/compare.mjs /absolute/path/to/equivalence-run
```

The comparison requires identical statuses, redirects, cache policies, visible
markup and all loader values after applying only the stats preview projection.
It does not add exceptions to the strict gate.
