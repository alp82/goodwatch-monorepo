# Solo multiplayer simulator

A local operator control page beside the **actual YepWatch host app**. Create a **fresh** ordinary memory room, add one to three artificial guests, and try choosing together alone. Bots use independent guest credentials, private HTTP snapshots, sequenced commands and first-frame-ticket WebSockets. Their choices are artificial and explicitly labelled here; the main app receives only its normal validated shared room projection. No app source changes or new runtime dependencies.

## Run

From the repository root, with the retained local POC app/API/gateway already available:

```bash
cd yepwatch-realtime
npm ci
npm run simulator
```

At handover the controller is already running on **http://127.0.0.1:8120** (PID `2852397`); open that URL instead of starting a duplicate process. The start command above is for a later stopped/fresh workspace.

Open **http://127.0.0.1:8120**. Click **Create fresh demo + open host app**, then **Start a round** in the real app on the right. Choose No/Watch and finish your own round there. You can also open the host in its own browser window.

Defaults:

| Service | Local address | Owner |
| --- | --- | --- |
| Simulator controls | `http://127.0.0.1:8120` | This package |
| Actual host app | `http://127.0.0.1:8101` | App thread |
| Room API | `http://127.0.0.1:15995` | Backend thread |
| Room WebSocket | `ws://127.0.0.1:4319` | Gateway thread |
| Disposable revision bus | `127.0.0.1:46397` | Existing POC |

The controller binds **127.0.0.1 only** and rejects non-loopback, credential-bearing, path/query and production origin settings. Use the literal `127.0.0.1` hostname, not `localhost`: the original API HttpOnly host cookie is forwarded on the same hostname, and cookies are not port-scoped. The normal `/r/<invite>` app route recovers the host identity. Native bot credentials stay in server memory; no app secret or gateway service secret is needed by this tool.

Optional environment variables: `YEPWATCH_SIM_PORT`, `YEPWATCH_SIM_API_ORIGIN`, `YEPWATCH_SIM_WS_ORIGIN`, `YEPWATCH_SIM_APP_ORIGIN`. All endpoint origins must be explicit `http://127.0.0.1:PORT` or `ws://127.0.0.1:PORT`. The actual app must be configured for the same API/WS pair. Never repoint a production tunnel through this tool. The tool starts/stops **only itself**; it does not provision, reset or restart retained app/API/cache/gateway services.

## Controls

- **Simulated people:** one to three clearly named people: Sim Alex, Sim Bea and Sim Casey. The host is Demo host. Count is chosen before creating a new demo.
- **Agreement:** all artificial choices are Watch. Every person still finishes explicitly; the host proposes a shortlisted title, everybody consents to that proposal version, and the host confirms the final choice.
- **Disagreement:** Sim Alex answers No to every card; others Watch. After all complete, the shortlist is genuinely empty (state-spec S04). There is no majority substitute, closest-match invention or automatic next deck. Start another round explicitly in the host app, or create another fresh demo.
- **Slow person:** the last simulated person acts five times slower than the selected pace. Everyone remains required. This is an action delay, not fabricated progress.
- **Run automatically / Pause automatic guests:** real artificial guest commands at the selected pace. The host stays manual. Auto consent accepts a currently proposed version only when that guest has not sent consent for it. It does not override an explicit manual decline for that version.
- **Step all guests once / individual Step:** one real phase-appropriate action per controlled person: ready, answer one private card, explicitly finish after all answers, set a private shortlist preference, or accept the current proposal. Private preference does not rank/select a title and is not consent.
- **Watch / No / Undo last / Finish:** explicit artificial private commands. No maps to `pass`; no third response option is introduced. Finish is distinct from merely answering every card; post-finish changes are rejected by the API.
- **Accept / Decline proposal:** explicit private consent for the current proposal version. A host re-proposal clears all consent in the authoritative API.
- **Pause person / Resume person:** stop/start only that artificial person's automatic actions. Their socket and all durable room state remain intact; manual controls still express explicit operator actions.
- **Disconnect / Reconnect:** close only that guest's socket and stop future automatic actions. Reconnect obtains a new one-use ticket and that identity's own private snapshot. Disconnect never removes membership, readies anyone, drops a required voter or changes votes/consent.
- **Recover / retry:** if an action outcome is uncertain, retry the retained command ID/sequence/body. Known rejected commands are not blindly replayed. The pending envelope and identities are server-memory-only; restarting this tool loses them. Never claim exactly-once recovery across a tool restart.

The controller deliberately shows **its own simulated people's private cards/actions** so one operator can understand independent choosing. Those are not somebody else's production inputs and are not sent to the main app, Valkey channel or room subscribers. All controller state stays on its authenticated same-origin local control page; mutation requests require its local cookie and exact Origin. The shared room channel still carries only revision hints and snapshots remain strictly checked by the normal gateway.

Fresh demos use DE / Netflix 8 on one confirmed Demo screen, guest movies and new shows. This matches the finite real sample currently used by the retained local POC. The host can explicitly change normal room settings in the app; the simulator does not silently broaden them after a failure. Guest continuation/manual history are forbidden and member auth is unimplemented. The tool never records GoodWatch viewing history.

## Freshness and lifecycle

There is **no existing room ID/invite input** and no way to attach arbitrary retained rooms. Every Create button sends ordinary API create, then ordinary independent guest joins. A new demo closes only this tool's previous sockets and stops its previous automation. It leaves previous room membership/votes intact; old required voters are not silently removed. The old memory room remains until API expiry, and a new room has a different identity.

Refreshing the controller page retains the current process's bot identities/pending state, but the host cookie must be in that browser to resume the host. For a different browser/operator, **create a fresh demo** rather than joining the previous demo. Closing a host window does not finish the host or consent on their behalf. Stopping the simulator with Ctrl+C closes only its connections; it never restarts the API or clears its rooms. API 6-hour expiry and resource bounds remain authoritative.

Cards are independently ordered for each bot, rotated through the same common deck. Displayed Choosing / Choices made / Finished and artificial answer diagnostics come from real own/shared snapshots. No elapsed timer increments a card/activity counter. The host app's public activity remains neutral and has no private current-card/choice associations or public fractions.

## Evidence and checks

```bash
cd yepwatch-realtime
npm run build
YEPWATCH_TEST_BACKEND=1 YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
# Against the running simulator and retained actual app/API, fresh demo rooms only:
node simulator/prove.cjs
```

The visible proof replaces only the controller’s current demo with several new test demos; do not run it while a person is using that controller.

The browser proof reuses the **app's installed** `@playwright/test` and bundled Chromium (`yepwatch-app/node_modules`); it adds no simulator runtime dependency. Install the app's existing dev dependencies/browser when absent. The proof uses visible operator/host controls, independent bot API/WS clients and fresh demo rooms. It never enters retained room IDs or restarts their services.

Automated build/typecheck and **22 tests pass, zero skipped**, including fresh simulator admissions for one/three controlled guests, independent sockets, reconnect/private repair, production-origin rejection and preserving previous room membership when creating another demo. Existing gateway privacy, heartbeat, backpressure, two-instance/three-master Valkey and actual guest-policy integration tests also pass.

Visible browser proof: **PASS**, two artificial guests plus the human-operated host, actual finite real catalog/memory API. It proves S02 independent cards/no early shortlist, S03 agreement through explicit consent/final decision, S04 disagreement/empty shortlist, S05 slow/pause/disconnect waiting and S14 fresh-ticket reconnect/private recovery. It observed **66 main-app shared frames, no private fields in those frames, zero JavaScript errors** in the latest complete visible run. Later reruns can vary the frame total because safe full snapshots coalesce. Screenshot/report files in `../artifacts/`:

- `simulator-independent-cards.png`
- `simulator-disconnected-wait.png`
- `simulator-agreement-decision.png`
- `simulator-disagreement-empty.png`
- `simulator-slow-paused-wait.png`
- `simulator-proof.json`
- `simulator-processes.json` (listener/PID inventory; all retained service PIDs matched the pre-simulator baseline)

Reports omit invites, credentials and private vote payloads. Screenshots intentionally show only the operator's artificial private controls plus normal host app views; no real user data is used. Other state-spec scenarios (late-join capability, held final recheck/CAS race, lost command acknowledgment, lease/bus failure and hard catalog failure injection) are not claimed by this visible simulator proof. Some are covered by existing independent tests; the browser proof is not an exhaustive state-machine review.

All results are local POC evidence over a finite catalog sample and memory rooms, not production persistence, full-catalog coverage, physical-device or load proof. The controller is a local development tool, not a deployed product endpoint.

## Narrow private-repair follow-up

Independent review found a simulator-only stale-view race: a newer shared revision could arrive while a private GET was held, and the queued-read flag discarded that later demand. The follow-up retains the highest per-actor revision, drains bounded private reads to that target, and labels the actor as refreshing while private state lags. A deterministic actual API/gateway/Valkey regression holds a bot’s voted snapshot across host new_round, releases the old response and verifies a follow-up private GET automatically restores empty votes/card and Setup. Build/typecheck and 22 tests pass. Original review pin remains unchanged under `/tmp/yepwatch-simulator-review-20261021`; this is a separate dirty-source follow-up. Retained controller 8120 was deliberately not restarted during review, so this source fix requires a coordinated later restart before it is active there.
