# YepWatch wire contract v1

Portable TypeScript only; no runtime dependencies, React, browser, server, database or environment imports. Consume as an isolated `file:` dependency; Metro/Vite may transpile the TS entrypoint. Do not upgrade the existing webapp's dependencies to consume it.

## HTTP

All paths are exported as `paths` under `/api/yepwatch/v1`.

- `POST paths.resolveInvite`: `ResolveInviteRequest {code}` → `ResolveInviteResponse {roomId}`. Invite paths encode the complete invite; manual entry supplies this same code. Resolution reveals no room snapshot or credentials.
- `POST paths.rooms`: `GuestAdmissionRequest` → `GuestAdmission`.
- `POST paths.join(roomId)`: `JoinRoomRequest` → `GuestAdmission`.
- `GET paths.snapshot(roomId)`: `RoomSnapshot`.
- `POST paths.commands(roomId)`: `CommandEnvelope` → `CommandResult`.
- `GET paths.showSearch?roomId=ROOM_ID&q=human+title`: authenticated `ShowSearchResponse`, bounded ID/title/year choices; never require guests to type IDs.
- `GET paths.metadata?country=CC`: `CatalogMetadata` (full existing country/service coverage).
- `GET paths.showProgress(roomId, showId)`: `ShowProgressResponse`: own progress/conflicts and canonical episode choices (with presentation labels); no other person's history. catalogState=unavailable is explicit, with no fabricated episode IDs.
- `POST paths.realtimeTicket(roomId)`: `RealtimeTicket` (implemented authenticated, one-use, 30 seconds maximum).
- `POST paths.memberStart`: `MemberStartRequest` → `MemberStartResponse` (reserved, not fake auth).

Create/join generate a high-entropy `admissionSecret` on the client (at least 32 random bytes, hex/base64url), retained unchanged for retries. This is a secret credential bootstrap, NOT the visible command ID or invite code. Native sends `X-YepWatch-Client: native` to request returned bearer credentials; browser admission sets a room HttpOnly cookie and omits usable token material from JSON (`credential.token` is empty). Other native requests send `Authorization: Bearer <token>` plus `X-YepWatch-Participant: <participantId>`. Browser requests use credentials/include; write Origin/CSRF validation remains mandatory. The native header changes credential delivery only and is not authorization.

Commands are sequenced per participant (`own.nextSequence`), one in flight. Retain command ID/sequence/body across retries. A conflict is not success; resnapshot/reconcile. `outcome_unknown` is not permission to replay as a new command. Vote/undo uses `expectedVoteRevision`; null value means undo.

Current user scope: guests choose movies and shows to start (`GUEST_CANDIDATE_KINDS`). Continuing shows requires actual linked GoodWatch saved progress, never manually entered history. Member authorization is not connected yet, so guest setup/start/episode proposals/progress reads are rejected with `member_required`; deprecated `show_progress` commands are always rejected with `manual_progress_not_supported` details. Existing guest continuation rounds cannot vote/finalize from old manual inputs; explicit host restart and scope correction remain available. No saved history is guessed, silently written or represented as episode entitlement.

Rounds ALWAYS finish before revealing/comparing shortlist. Each included participant votes on every common candidate then sends complete_round. Preferences are private. Host proposes a shortlisted title; everyone consents privately to that proposal version, then decide commits. Public consent is count only. No early-match interruption.

## Realtime / privacy

WS URL is `paths.realtime`, first frame `authenticate` with a one-use ticket obtained through authenticated HTTP, NOT a code or query credential. API hooks publish ONLY `RoomInvalidation` revision hints. Gateway implementation is separate. No normal polling interval.

Only `SharedRoomSnapshot` may be broadcast. `RoomSnapshot.own`, raw aggregates, command envelopes/receipts and admission credentials MUST NOT be broadcast. Public participation is nickname/screen/ready/included/waiting/completedCount plus nonauthoritative presence. Never emit another person's vote, direction, current card/candidate identity, shortlist preference, private progress or individual consent. Common deck/shortlist/chosen title are intentional shared state, never a person's activity trail. Different participants can be on different cards. Aggregate outcomes can allow inference in small groups; this is access control, not anonymity.

Member routes remain reserved and report not_implemented; guest ticket issuance/consume and gateway attach/view are implemented. Private gateway hooks are POST paths.realtimeAttach and paths.realtimeView, service-bearer authenticated. Tickets are one-use (30 seconds); shared:read leases renew to at most 60 seconds and never beyond room expiry. View returns the renewed lease token; participant capabilityEpoch is rechecked on every view. Subscribe/ACK to the revision bus before requesting the final initial view. The bus is REVISION_CHANNEL (yepwatch:v1:revision), payload {roomId,revision} only. Coordinate incompatible changes with the backend/frontend owner before editing this package.

OwnPrivateSnapshot.roundCompleted restores acknowledged completion after reconnect; completedCount alone does not mean completion. Shortlist.proposalVersion fences consent/decide independently of shortlist.version. The existing explicit shared episode proposal shape is reserved for future linked-member continuation; the guest API does not accept it. Saved-progress reads and explicit group approval must remain separate from manual-history entry. Future member reads must not derive a queryable proposal from other people’s private history. Re-admission with an existing valid room cookie/bearer returns the existing participant (`recovered:true`) rather than creating/replacing identity. Invalid credentials fail without silently replacing the browser cookie.

`start_round.hostReady:true` explicitly expresses readiness only for the host, atomically with a successful start. Its screen must already be confirmed; every other included person must already be ready. It cannot auto-ready another person, bypass context/version fences or persist readiness when the start fails.

`ApiError.error.details` gives typed public recovery information. Access failures name the unavailable member link/manual-input rule and offer `use_guest_modes`. Deck failures distinguish unknown availability, episode/catalog gaps, scan limit, deadline, filtered-empty pool and verified empty intersection; they include only public screen country/service IDs and aggregate checked counts. One verified screen exclusion rules a title out even if another screen is unknown. Unsupported media kinds never contribute false unknown failures. No vote/history/candidate trail or credential is included. Invitation paths stay relative; resolve them against the public app origin, never the API origin.
