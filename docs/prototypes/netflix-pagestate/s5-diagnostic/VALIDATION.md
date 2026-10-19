# S5 diagnostic v1 offline validation

Ticket #730; owner-only under Q30. Implementation review and owner live run are pending. Nothing is released to members; #732 owns member terms research.

## Environment and results

- Node v24.15.0; real Chromium from the locally installed `chromium-1248`, controlled with locally installed `playwright-core`.
- `npm test`: **47 passing tests**, zero failures, approximately **30 seconds**. Includes two offline packaging/parser tests and 45 Chromium cases, including the real unpacked extension/popup and a real service worker with a loopback HTTP server.
- Netflix-looking URLs in tests are fulfilled locally, with non-fixture name resolution blocked. The worker fixture uses only `127.0.0.1`. No authenticated/API request to Netflix was sent.
- The production one-second gap is checked against wall time. Memory/call-budget tests accelerate only the external clock; other request, parser and lifecycle code is unchanged.
- The exact private package, with its actual static adapter and fixture hooks disabled, also passed a separate Chromium smoke against the synthetic server: two whole-row calls, agreement, `snapshot_unproven`, zero unexpected requests and released module state. This was not a Netflix run.
- Offline extraction from the saved client verifies one `CarouselPage` query, 23 variable names and 55 fragments, including the row and connection fragments. Actual build/document values stay in the new private package, never Git or reports.

## Observed behaviors

- A synthetic 77-entry list takes two whole-row S5-issued calls, separated by the gap, and yields agreement with `partial` / `snapshot_unproven`.
- Valid clamping yields one full paged pass, records actual requested/returned sizes and keeps paged coverage separate from single-response results. A paged initial read does not launch a confirming pass.
- P4 faults produce their own fixed codes, exclude the whole offending page and stop without another call. Equal-count tail changes fail repeat comparison. Stable foreign cards downgrade and stop confirmation.
- Profile/reference/build/fetch changes, unsupported desktop/endpoint modes, identifiable wrappers, accessors and controlling workers stop/refuse safely. Browser-managed credentials work without cookie/token/storage reads in the runtime.
- A retrying native-looking proxy produces four fixture-server requests for two S5-issued calls; the report continues to say `networkBehavior: unproven`. A real service worker produces two loopback-server requests from one page fetch. These demonstrate why no wire-request cap is claimed.
- The 60-call cap, 2 MB response cap, 8 MB accounting budget, per-call/read/finalize deadlines, authentication/rate-limit errors and no-negotiation policy are exercised.
- Successful and interrupted runs clear actual membership/card maps and module/reference/request fields; late responses and abort-ignoring readers cannot repopulate them or mutate the frozen report. Stop, Cancel, cleanup failure and interruption during validation are exercised, including an explicit new Start after Cancel.

## Limits

- No Netflix live result, supported server page size, required-header compatibility or latency is established by fixtures.
- The native-looking fetch check is heuristic; the worker/controller guards and abort signal do not establish control over browser/wrapper/worker-owned copies or downstream network behavior.
- The eight-megabyte limit is the designed accounting of retained entries, card state, chunks, strings and request bodies, not a measured whole-browser heap ceiling or zeroization guarantee.
- A whole-row response is the strongest available consistency evidence; agreement adds repeatability, never snapshot proof. `complete` is never emitted.
- The owner package must pass Astra's implementation review before loading. Estimated owner checklist time is 4–6 minutes; no owner time has been measured yet.
