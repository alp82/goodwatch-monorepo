# Homepage search request size

The reported homepage Enter search for `funny science fiction` reproduces as a successful
`/api/combined-search` response followed by HTTP 431 from `/api/discover/results`.
The search returns 1,092 ranked title keys. The homepage encoded them in a 17,582-character
URL, exceeding the HTTP request header limit. Discover already uses `discoverFetch`, which
moves large ranked lists into a POST body; the homepage bypassed it.

The homepage now uses that existing transport, preserving the complete ranking, filters,
guest progress, cancellation signal, and retry behavior.

Validation:

- Before the fix, four regression cases reproduce the visible `Discover couldn't load right now`
  error: Enter on the reported phrase, guest/member, 1,092/5,000 ranked titles.
- After the fix, all 34 tests pass:
  `node --test app/ui/start/search/start-search.test.ts app/ui/discover/discover-fetch.test.ts app/ui/discover/discover-search-request.test.ts`
  from `goodwatch-webapp/`.
- A Playwright replay against the deployed homepage reproduced HTTP 431. Replaying the same
  results request through the actual `discoverFetch` helper, using browser request interception,
  sends a 105-character URL and all 1,092 keys in the POST body. The server returns HTTP 200
  and the homepage renders results without the error. This verifies the deployed endpoint and
  transport together; the change itself is not deployed.
- Biome and `git diff --check` pass for the changes.
- Full type checking reports 204 errors elsewhere, including missing Better Auth/Vitest modules
  and existing typing errors. No errors refer to `start-search` or `discover-fetch`.
- The required landing budget ran against the unchanged deployed site:
  `SHARE_LIST_PATH='/u/alperortac/lists/o1H79d4fVu' ./bench.sh budget --where local --runs 1`
  from `goodwatch-benchmark/`. Run `20261030T154550Z-lighthouse-budget` fails existing budgets
  for home, show, person, and share list; movie and Discover pass. Home scores 99, but exceeds
  request, script, image, blocking-request, and total-byte limits. This is a production baseline,
  not a measurement of the undeployed fix. No budget limits were changed.
