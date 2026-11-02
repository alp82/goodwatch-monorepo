# Discover query lab

Question: do inferred filters and common-value guesses match what a person meant,
while preserving existing Discover selections?

Run from `goodwatch-webapp`:

```sh
npm run lab:discover
```

Open http://127.0.0.1:5198. The server binds to loopback only and does not load
the app, its database, search indexes or title snapshot. The rules and entity resolver are shared with start-page search. The lab alone
offers the optional extra fingerprint read; descriptive remaining text on the TV
continues through the existing combined search.

Rules run while typing. Choose **Rules + fingerprint read** and press **Run**
for the semantic interpretation. The server reads `TYPESAFE_API_KEY` from
the existing webapp `.env` or environment;
keys never enter browser responses. Jev reads the existing fingerprint
vocabulary (want/avoid) plus supported filter concepts. It does not score titles.
Reads are paid API calls, explicitly triggered and cached in process memory.
Title/person clauses use Discover's existing title and cast lookup APIs; the chosen
entity and guesses are shown. If lookup is unavailable, unresolved clauses remain
in search text. Entity lookups are cached in memory.

The original phrase set is in `phrases.json`; independent adversarial sets are
in `cases/*.json`. `generated-cases.mjs` adds all 24 orderings of each of six
four-part requests. All of these appear in the browser lab. Edit them on disk
or in the page, evaluate
the set, inspect expected-value mismatches, and download results. Expectations
are a subset of URL filters; comma-separated arrays compare without order.
Open probes omit `expect`. Nothing is persisted automatically.

Run the full regression suite against the running lab:

```sh
npm run lab:discover:check -- --semantic --out /tmp/discover-query-results.json
npm run lab:discover:check -- --reverse
npm run lab:discover:assertions
npm run lab:discover:browser
```

The checker pins unspecified case dates to 2026-11-01, as the browser suite does.
`--semantic` enables the explicitly annotated model cases; without it they are
reported as needing a fingerprint read, never counted as passes. `--reverse`
checks a different cache-population order. `--file path.json` runs one set;
`--url http://127.0.0.1:5198` selects the lab instance. Failures set a nonzero
exit status. `exact: true` rejects extra inferred filters, and `warningContains`
asserts a required explanation. The browser and CLI use the same evaluator.

The browser regression command reuses the workspace's Playwright installation
(including the one in `yepwatch-app`) and checks stale preview responses,
immutable suite inputs/model mode, truthful pass/fail/probe counts and mobile
overflow. The evaluator tests deliberately feed it wrong responses to verify
that the checks can fail. See [AUDIT.md](./AUDIT.md) for the independent audit.

**Open title results in Discover** opens the actual filtered/search result page.
**Load catalog preview** fetches real anonymous cards inline for the extracted
filters; it does not apply remaining search text or your signed-in taste/history.
It uses https://goodwatch.app by default. To use a local app instead:

```sh
DISCOVER_LAB_ORIGIN=http://localhost:3000 npm run lab:discover
```

`DISCOVER_LAB_PORT` changes the lab port. Personal filters need a signed-in
Discover session with the corresponding data. Current Discover retrieval and
postfilter behavior still applies; this lab does not change ranking.

Interpretation policy:

- Choose the latest decade that has begun: in 2026, 20s = 2020–2029, 90s = 1990–1999.
- Explicit existing parameters lock their filter group, even default values.
  Year presets and year bounds are one group, runtime bounds another. Content
  choices lock per kind. Existing selections win over both rules and reads.
- Within inferred values, explicit wording wins over semantic guesses. Existing
  list semantics and limits apply (up to three moods, themes and styles).
- Common guesses are shown in explanations: kids 12, preschool 6, teens 16,
  short ≤90 minutes, good ≥70, excellent ≥80.
- Bare integer scores and unitless score comparisons use the 0–100 scale.
  Durations, years, audience ages and monetary amounts are recognized first.
- Compound and spelled durations, duration/year ranges, explicit field labels
  and strict inequalities are supported; invalid ranges stay as text.
- Service shorthand includes Disney → Disney+ and Prime → Prime Video, with
  aliases shared across provider rules and compound-reference detection.
- Runtime inequalities become inclusive minute bounds: under 90 = at most 89.
- Quoted title names remain literal. Story period never means release decade.
- Unsupported filters (language/dubs, awards, negative genres and credit roles)
  stay in the search text. Total viewing hours and taste exploration are excluded.
- Unsupported negations remain negative in the remaining text. An OR across
  different filter groups stays unresolved instead of becoming an AND; current
  same-group OR semantics still apply. Independent supported filters can apply.
- Entity lookup currently chooses the best match; inspect it for ambiguous names.
  Cast versus director roles cannot be enforced by today's combined people filter.
- Full titles are checked before shorter reference prefixes. Quoted lists and
  multiple people/references compose. Dominant surname guesses are labelled;
  unrelated substring matches are not treated as confirmed title references.
- Preview requests use the interpretation's original input snapshot. Evaluations
  freeze their fixture set, reference date and model mode while running.

The lab UI is local review tooling. Its rule engine and entity resolver are
shared with the current start-page search.


## Current start-page integration

The implementation uses the search-first painted-room start page on current
`main`, not the retired TV. The original phrase stays in the search field.
Supported phrases become Discover filters and appear in its existing **Read as**
row. Manually selected mood/theme/style picks win conflicts. Filter-only requests
browse the catalog; remaining text ranks within type/service/person/year eligibility.
Descriptive mood/theme/style/genre phrases remain in the semantic query even when
they also become filters, so the existing fingerprint read still runs. Fingerprint
chips precede rule labels; parser warnings remain hidden on the start page.
**See all** carries resolved filters and remaining text into Discover.

Run the app with its development environment:

```sh
APP_ORIGIN=http://127.0.0.1:3003 REDIS_COMMAND_TIMEOUT_MS=10000 npm run dev -- --host 127.0.0.1 --port 3003
```

Open <http://127.0.0.1:3003/?q=tom+hanks+disney>.
Run `node scripts/discover-query-lab/start-page-check.mjs` against the local app
for live desktop/mobile checks. Browser tooling comes from the workspace's
`yepwatch-app/node_modules` Playwright installation.

The local review server uses `TITLE_SNAPSHOT_REDIS_URL=redis://127.0.0.1:16391`,
an isolated loopback cache containing a read-only copy of 262,848 real catalog
titles, ratings for 51 countries and format-3 facts for 228 production countries.
The snapshot refresh writes only to that local cache; deployed configuration is unchanged.

Verified on current main: 205 interpreter/start-page controller/render/query tests, 704 rule
cases, live filter-only and mixed searches, manual precedence, See all and mobile.
One additional rule case requires the optional fingerprint read. Full typecheck
has existing errors outside these changes. The performance budget command is
blocked by missing `SHARE_LIST_PATH` in benchmark configuration.


## Added filter coverage

Current coverage includes budget and box-office ranges (nominal USD millions),
hits/flops, season counts, show status, separate episode duration, vote counts,
popularity ranks, all six score sources, critics/audience comparisons, seen-only,
wishlist, all-of tag groups, any streaming service, the provider catalog and full
country names, age-rating country, rest-of-world origin, relevance and personalization
Off. Dollar amounts and abbreviated millions/billions are supported; unspecified
small budget/box-office amounts use USD millions as a labelled guess. Strict money
bounds use the snapshot's USD-thousands precision. Source thresholds use their
native scale: IMDb/Metacritic users 0–10, Letterboxd 0–5, the others 0–100; explicit
percentages and /5, /10, /100 notation are supported. Unsupported source ceilings
and invalid values stay text rather than becoming a GoodWatch score.

`controversial`, `divisive` and `polarizing` use `gap=audience` as a labelled guess:
Discover has no direction-neutral disagreement choice. Explicit critics-first,
audience-first and agreement wording select their existing options. Existing
source thresholds win per source; other source floors can still be added. Compatible
range clauses intersect; existing manually selected ranges win.

`cases/current-filter-coverage.json` adds 149 direct/negative/precedence examples;
`cases/current-filter-composition.json` adds 72 permutations, including named people.
`app/domain/discover-query-coverage.test.ts` checks these rules against Discover's
real parameter parser and protects numeric title/person names and catalog collisions.

Run `node scripts/discover-query-lab/expanded-filter-check.mjs` for live API,
catalog, See all, and mobile checks. The local lab is now at its original
<http://127.0.0.1:5198>, using the local app at port 3003 for lookups and previews.
