# Room redesign backend handoff

Implementation branch: `feat/yepwatch-room-redesign`. Contract 3 changed in place. No push, deployment, production DDL or account/database access was performed. The UI redesign and OTA release remain separate work.

## Changed files

- Shared types: `goodwatch-webapp/packages/yepwatch-contracts/{proposal,index}.ts`.
- Commands and deck: `proposal-redesign.ts`, `proposal-machine.ts`, `proposal-service.server.ts`, `proposal-validation.ts`, `proposal-types.ts`, `proposal-intent.ts`, `proposal-guest-catalog.server.ts` under `goodwatch-webapp/app/server/yepwatch/`.
- Persistence: `proposal-storage-schema.ts`, `proposal-relational-repository.ts`, generated `schema.sql`, and both migration files in that server directory.
- Member reads: `continuous-members.server.ts`, `continuous-member-reads.server.ts`, `member-resource.server.ts`, `proposal-release-members.ts`, `proposal-http.server.ts`, and `goodwatch-webapp/app/routes/api.yepwatch.account.ts`.
- Catalog: `provider-catalog.ts` and `goodwatch-webapp/app/server/combined-search/{search,yepwatch}.server.ts`.
- Gateway: `yepwatch-realtime/src/{proposal-projection,gateway}.ts` plus updated fixtures and projection tests.
- Client: `yepwatch-app/src/core/continuous/wire.ts`, minimal current-screen/settings adapters under `src/features/{glow,rooms}/`, and matching test fixtures.
- Domain decision: `docs/adr/yepwatch-room-ideas.md` supersedes the previous description/service/deck rules; the root `CONTEXT.md` points to it. This records the owner's new decisions without a second domain context.

## Client API

`await continuousApi.invitePreview(code)` reads a room before joining via public
`POST /api/yepwatch/v1/proposal/invites/preview` with `{ code }`. It returns the
shared `InvitePreview` contract: `{ roomId, hostName, ideas: {text}[], kinds,
phase, people }`. `hostName` is null for an unnamed or absent host; `ideas` contains
only switched-on ideas in room order; `kinds` uses `movie`, `show_start` and
`show_continue`; `phase` is `setup`, `choosing` or `decided`; `people` counts
participants who have not left, including disconnected participants. The client
strictly validates the response, including each idea object. No participant IDs,
services, votes, proposal or candidate data are exposed. The endpoint sets no
room credential and makes no room changes. It shares resolve's request schema,
code normalization, capability lookup, active-room guard and error handling;
unknown codes return `not_found` and expired rooms return `expired`. Six-character,
previous 16-character and legacy signed codes work as they do with resolve.

The existing `useContinuousRoom(...).send(command)` supports the commands below. The lower-level method remains `continuousApi.command(access, {commandId, sequence, command})`; use the existing controller to serialize commands and preserve uncertain-command envelopes. Types are exported from `@goodwatch/yepwatch-contracts/proposal`.

```ts
send({type: 'add_idea', text: 'A cosy mystery'});
send({type: 'edit_idea', ideaId, text: 'A clever mystery'});
send({type: 'remove_idea', ideaId});
send({type: 'set_idea', ideaId, on: true});
send({type: 'set_services', serviceIds: [8, 337]});
send({type: 'set_service_enabled', serviceIds: [337], enabled: false});
send({type: 'configure', expectedContextVersion: shared.contextVersion,
      country: 'DE', constraints: {kinds: ['movie', 'show_start'], moods: [], maxMinutes: null}});
send({type: 'rename', nickname: 'Alex'});
send({type: 'set_show_seen', show: true});
```

Country and constraints are independently optional in `configure`. It no longer accepts prompt/services. No command above resets generation, answers or the round. Existing vote/propose/agree/refill/retry/restart/leave APIs remain. Start requires the host's nonempty nickname plus enabled room services. Creation accepts an empty nickname; guest joins require a name. Idea text is 2–200 trimmed characters; names are 1–40; service picks contain 0–100 IDs. Host-only: configure, idea switches and service switches. Anyone adds an idea; only its author edits; author or host removes. Linked members alone can set show-seen.

Shared snapshots now require `ideas: {id,text,authorId,on,attributes}[]`, `disabledServiceIds: number[]`, and participant `serviceIds: number[] | null`. `description` and `savedServiceIds` have been removed. `screens[0]` still supplies shared country and the derived enabled union. Null picks contribute nothing but remain required voters and approvers. The gateway shares ideas and disabled services with every authenticated room participant, regardless of `roomDetails`. Idea authors are public; proposer/approver identities, candidate attribution and ranked lists remain private. `own.showSeen` defaults false, including before linking.

The command ID becomes the ID of a successfully added idea. The response snapshot is authoritative. Show NEW by comparing ideas/authors with local acknowledgement state; the server does not provide a separate NEW flag. Provider groups include `minor: boolean`, canonical subscription names and ordering. Service switch commands take all IDs in a group's `selectionIds`.

## Deck behavior for the UI builder

Idea/service/kind changes bump `stream.version` and set ready, so reconsider refill after each change. A service/kind/idea change may withdraw a match/proposal while retaining its answered card and votes. Every answer record, including an undo, retains the card during settings changes. Retired untouched titles leave `seenKeys` and may return. Never show candidate idea labels.

`capacity/room_capacity` at 2000 seen keys is a quiet stop. `capacity/awaiting_answers` is the 120 active-card bound. Do not show a completion/error screen for these states. Empty refills should show “Finding more…” with bounded retry/backoff; a hard lifetime cap will not be overcome by rapid retries. Normal start/refill never projects catalog exhaustion, but the finite catalog and resource bounds still apply. This backend handoff does not implement the new empty-deck UI.

Budget exhaustion returns `limit_reached`. At most eight ideas exist at once, with 24 lifetime search reservations per room; remove/restart do not replenish reservations. Failed searches and legacy draft previews also reserve slots. UI should send add/edit directly instead of preview plus add/edit. An unchanged edit is rejected before search. CAS publication retries reuse the interpretation; a lost reservation acknowledgement does not start search.

## Client error handling

- `needs_context` from refill means nobody brings a service. Prompt participants to pick services instead of showing an error.
- `set_services` may return `needs_context` when clearing the last enabled service while voting. Keep the current selection and prompt for a service.
- When the host changes country, send `configure` with the new country before `set_services`, so service validation uses the updated country.
- The room needs a country before anyone sends `set_services` (`needs_context` otherwise). The app sets it with `configure` right after creating the room.
- `limit_reached` signals the idea budget: at most eight current ideas and 24 lifetime interpretations. Removing an idea frees a current slot; it does not restore the lifetime budget.

## Storage and search

Apply `goodwatch-webapp/app/server/yepwatch/migrations/20261101-room-redesign.sql` before deploying server/gateway/client together. It adds nullable room idea references, disabled services and interpretation count; participant services and show-seen; candidate idea IDs; and the immutable `doc.yepwatch_idea` table with runtime DQL/DML grants. `apply-room-redesign.ts` exports `applyRoomRedesign(sql)` for idempotent replay through an operator-supplied SQL connection: it checks `information_schema.columns` before each ADD. Crate’s documented [ALTER TABLE syntax](https://cratedb.com/docs/crate/reference/en/latest/sql/statements/alter-table.html) does not support ADD COLUMN IF NOT EXISTS. No startup migration runs. Existing nullable columns receive code defaults and legacy immutable-record hashes remain readable. `schema.sql` is regenerated by the existing script.

Room search now requests 500 ranked keys. The existing ranker accepts this limit, and the response list allows 500; other callers keep their existing requested lengths. Model-based display enrichment remains limited to the existing head. Extra results use existing ranking and catalog metadata. Live latency is unmeasured: production access is prohibited and no disposable search stack is available here. The under-one-second target remains unverified.

GoodWatch `GET /api/yepwatch/account?view=seen` reads the verified viewer's existing seen-title set under `yepwatch:read`. It accepts no account ID and does not write progress. The release member adapter reads this view through the existing grant, caches per room/member/roster version and refreshes after join. With `YEPWATCH_MEMBER_ENABLED=false`, the release constructs no member adapter, so this read path stays inert.

## Verification

Final checks in this workspace:

- Required machine/catalog suites plus redesign tests: 39 passing, including 14 new redesign tests. The exact brief command also exits successfully (the default process-isolated reporter counts its three files); `--test-isolation=none` gives individual test counts.
- Broader proposal/member/provider set: 73 passing, five opt-in Crate suites skipped; two HTTP-listener tests excluded after confirming sandbox EPERM failures.
- App: typecheck passes; lint passes with one pre-existing unused-View warning. 108 unit tests pass; the remaining real HTTP-listener test is blocked by EPERM. The npm test wrapper itself cannot create tsx's IPC socket here, so tests were also run with Node's tsx import loader and no process isolation.
- Gateway: build/typecheck pass. Eleven non-network tests pass; nine opt-in infrastructure tests skip. All 28 socket-based tests are blocked by EPERM; the npm test wrapper is likewise blocked by its IPC socket. Includes a new strict ideas/services/privacy projection test.
- Standalone backend release bundle builds with no fixture or member-issuer dependency. Backend TypeScript checks report 58 existing diagnostics outside the touched YepWatch/search paths; no diagnostics in the owned paths.
- Schema regeneration is byte-for-byte stable; `git diff --check` passes.

Requested commits could not be created: Git cannot create `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.git/worktrees/yw-build/index.lock` because the Git metadata filesystem is read-only. All changes remain in the working tree. Intended logical commits are `feat(yepwatch): implement room ideas and streaming union` (server/contracts/migration/tests/domain decision) and `feat(yepwatch): adapt gateway and client room contract` (gateway/client adapters/tests/handoff). No push was attempted.

 Socket listeners and Docker access are denied by this workspace sandbox; real WebSocket/browser/HTTP-listener suites, disposable Crate migrations with existing rows, and live search timing require another environment. The current screen adapters only keep the existing screens usable/compiling; they do not implement the approved redesign or establish OTA/browser acceptance.
