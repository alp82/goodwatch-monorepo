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

Start supports movies, shows to start, and shows to continue. Show progress inputs/explicit per-episode approval are PRIVATE; continuation cannot assume a guest's history, force rewinding/spoilers, mutate history, or infer episode entitlement from title evidence. A missing catalog/episode adapter must return an explicit unavailable/conflict result, not silently substitute movies-only.

Rounds ALWAYS finish before revealing/comparing shortlist. Each included participant votes on every common candidate then sends complete_round. Preferences are private. Host proposes a shortlisted title; everyone consents privately to that proposal version, then decide commits. Public consent is count only. No early-match interruption.

## Realtime / privacy

WS URL is `paths.realtime`, first frame `authenticate` with a one-use ticket obtained through authenticated HTTP, NOT a code or query credential. API hooks publish ONLY `RoomInvalidation` revision hints. Gateway implementation is separate. No normal polling interval.

Only `SharedRoomSnapshot` may be broadcast. `RoomSnapshot.own`, raw aggregates, command envelopes/receipts and admission credentials MUST NOT be broadcast. Public participation is nickname/screen/ready/included/waiting/completedCount plus nonauthoritative presence. Never emit another person's vote, direction, current card/candidate identity, shortlist preference, private progress or individual consent. Common deck/shortlist/chosen title are intentional shared state, never a person's activity trail. Different participants can be on different cards. Aggregate outcomes can allow inference in small groups; this is access control, not anonymity.

Member routes remain reserved and report not_implemented; guest ticket issuance/consume and gateway attach/view are implemented. Private gateway hooks are POST paths.realtimeAttach and paths.realtimeView, service-bearer authenticated. Tickets are one-use (30 seconds); shared:read leases renew to at most 60 seconds and never beyond room expiry. View returns the renewed lease token; participant capabilityEpoch is rechecked on every view. Subscribe/ACK to the revision bus before requesting the final initial view. The bus is REVISION_CHANNEL (yepwatch:v1:revision), payload {roomId,revision} only. Coordinate incompatible changes with the backend/frontend owner before editing this package.

OwnPrivateSnapshot.roundCompleted restores acknowledged completion after reconnect; completedCount alone does not mean completion. Shortlist.proposalVersion fences consent/decide independently of shortlist.version. In setup, only an explicit host command `propose_episode {expectedContextVersion,showId,episodeId}` publishes `shared.episodeProposals`. It resolves backend-known canonical identity, increments contextVersion/proposal version and clears old approvals/readiness. GET showProgress can reflect that intentionally public proposal plus caller-only conflicts; it NEVER derives an episode or selected-show list from other people’s private progress. No proposal means proposedEpisode=null even when another person has private history. Missing/unknown own history is unresolved; every person supplies private progress and explicitly approves the public proposed episode. Re-admission with an existing valid room cookie/bearer returns the existing participant (`recovered:true`) rather than creating/replacing identity. Invalid credentials fail without silently replacing the browser cookie.
