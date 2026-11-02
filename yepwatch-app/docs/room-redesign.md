# Room redesign: ideas, per-person streaming, endless deck

Status: deployed to main 2026-11-01 (a9d53fd91, fixes 005f89ddf and 2b113728f); OTA after the production run. Owner-approved prototype: branch `prototype/yepwatch-room-create`, commit `9a2241e3e`, file `yepwatch-app/src/features/prototype-create/CreateLab.web.tsx` (read it with `git show 9a2241e3e:yepwatch-app/src/features/prototype-create/CreateLab.web.tsx`). The prototype is the source of truth for screens, wording, hierarchy and behavior. This document lists what the real app and server must do, and the decisions the prototype doesn't show.

## Owner decisions

- No backward compatibility. Nobody uses rooms yet. Change contract 3 in place; old rooms may be dropped.
- Privacy stays: proposer and approver identities are never shared. The proposal screen says "Someone proposes" (or "Your proposal" for the proposer) and shows only "2 of 3 agree".
- Ideas: anyone can add ideas; the host's ideas start on; friends' ideas arrive off ("NEW" badge for the host). Only the host switches ideas on or off. Everyone sees the same list, with switches disabled for non-hosts. Idea authors are shown (faces).
- Streaming is per person: GoodWatch members bring saved services, guests pick their own. The room uses the union; the host can switch any service off (final say).
- Changing ideas, services, or movies/shows never restarts the round. Votes and matches stay.
- The deck never ends. No "you're done", no capacity end state shown to people.
- GoodWatch members: titles they have seen are excluded by default. Each member has a switch to show them again ("Show titles I've seen", off by default).
- Mood is the headline everywhere; names are small. A guest host names themselves after creating the room.
- No native modules may be added: the release ships as an EAS OTA update on build 16 (fingerprint must match). See `docs/ota-updates.md`.
- Ship to main and release via OTA (owner, 2026-11-01).

## Flow

1. Start page. First visit: hero, Create a room, Join a room (and Continue with GoodWatch where member sign-in is enabled). Returning: greeting, "Your rooms" with LIVE badge (pulsing green dot) for open rooms, New room, Join a room.
2. Create makes the room at once (link exists) and opens the Mood step: one big field (GoodWatch start-bar look, placeholder "Describe a mood, a plot, or a title…"), "or try:" presets (small chips), "Anything goes". Enter or a preset continues; Next appears once you type.
3. Room page (host, before Start): share card (faces, link, Share), MOOD = the ideas list, quiet rows "Movies and shows · Change" (film/tv icons) and streaming ("Netflix, Prime Video +2 · Change"), small "Your name" field + "or" + Continue with GoodWatch when the host has no name. One action: Start (needs a name and at least one service).
4. Friends open the link: join screen (a full room screen with Back, no start page underneath) with the room's ideas as headline, "Your name" + Join (or Continue with GoodWatch / Join as Mia for members); guests then pick "Your services"; then the waiting screen (ideas list with disabled switches, + Suggest an idea, your services, "Waiting for Alp to start").
5. Voting: one top row (Back, room control "cheer me up +1" with amber badge for new suggestions and faces, Undo). Card with poster, score, title, meta, service logos. No idea label, no count. Matches bar, Nope / Yep. Deck refills in the background.
6. Room control opens the Room page: IDEAS (switches, + Add/Suggest an idea), PEOPLE (share card), Movies and shows, Streaming, Leave room.
7. Matches page: each match with Propose this / Propose this instead.
8. Proposal: shown to everyone in the round as a full screen until decided or set aside with Keep swiping (client state, per device). Agree / Keep swiping; after agreeing: "You agree" + Take back. The matches bar reopens it.
9. Tonight: poster, title, scores, watch button for the first enabled service ("Watch on <service>"), host Start again ("Alp can start again" for others). Tapping or holding the poster cheers: an easter egg, no button or hint (polish round 2026-11-02).

Navigation: every screen has Back. Back from Mood (at creation) returns to the room page with "Anything"; Back from the room returns to the start page where the room stays listed; Back from voting/Tonight returns to the start page (friends: back where they came from). Browser back/forward and Android back follow the same history.

Visual rules: GoodWatch dark style, Gabarito, amber accents, corners 6-12 px (faces and switches stay round), no prose: plain labels only. Idea rows fit text size to length (one line when it fits, else two lines, min 17 px); author face and pencil at the row end; "NEW" inline badge (no layout shift).

## Contract changes (contract 3, in place)

Shared snapshot:

- `ideas: { id: string; text: string; authorId: string; on: boolean; attributes: RoomDescription['attributes'] }[]` replaces `description`.
- `disabledServiceIds: number[]` (host switches).
- Participants gain `serviceIds: number[] | null` (null = not picked yet). Room-level `screens[0].serviceIds` becomes the derived union of present participants' services minus `disabledServiceIds` (keep `screens[0]` for country).
- Participants' `nickname` may be empty until set.
- `savedServiceIds` is removed (replaced by per-person services).
- Proposal stays as today (no identities).

Own snapshot:

- `own.showSeen: boolean` (members only; default false).

Commands (all work in `setup` and `voting`; none resets the round):

| Command | Payload | Who | Effect |
| --- | --- | --- | --- |
| `add_idea` | `text` (2-200) | anyone | New idea, `on` = author is host. Interpreted via the existing room search (Jev) like today's prompt. Max 8 ideas per room. |
| `edit_idea` | `ideaId, text` | author | Re-interpret; replaces that idea's unanswered cards. |
| `remove_idea` | `ideaId` | author or host | Removes it and its unanswered cards. |
| `set_idea` | `ideaId, on` | host | On: its cards join the deck. Off: its unanswered cards leave the deck. |
| `set_services` | `serviceIds` (0-100) | self | Own services. |
| `set_service_enabled` | `serviceIds, enabled` | host | Host switch. |
| `configure` | `country?, constraints?` | host | Country and movies/shows (no prompt, no services). |
| `rename` | `nickname` (1-40) | self | Sets your name. |
| `set_show_seen` | `show` | self (linked member) | Seen-title filter. |
| `start` | as today | host | Requires a host nickname and at least one enabled service. |

Keep `vote`, `propose`, `agree`, `refill`, `retry_agreement`, `restart`, `leave`. Admission: the host's `create` nickname may be empty; joiners still need one (or a member display name).

## Deck

- Each idea that is on has its own ranked key list (from its interpretation). The deck interleaves cards round-robin across the on ideas. With no on ideas, the deck uses the base popularity order (today's no-prompt behavior).
- When an idea's ranked keys run out (after availability and filters), that idea continues with base popularity order, so the deck never ends. Keep the 2000 seen-keys cap and the 120 active cap as internal limits, but the client never shows an end screen: if a refill returns nothing it shows a "Finding more…" placeholder and retries.
- Filters on every candidate: kinds, enabled services (availability), and for each present linked member with `showSeen = false`, the titles that member has seen on GoodWatch.
- Turning an idea off, removing services or kinds retires unanswered cards that no longer qualify; answered cards and matches stay.
- Candidates carry the idea id internally (for retiring); the client does not show it.

## Seen titles (GoodWatch members)

The YepWatch API reads each linked member's seen titles from GoodWatch through the existing member grant (like saved progress, `continuous-member-reads.server.ts`). If the existing account resource doesn't expose seen titles, add a read-only route on the GoodWatch side under the same resource and scope. Cache per room for the session; refresh on join.

## Storage

Additive columns on the Crate tables (owner approved applying them on production before the push):

- `doc.yepwatch_room`: `idea_records ARRAY(TEXT)`, `disabled_service_ids ARRAY(BIGINT)`; drop the use of `intent` (column may stay).
- `doc.yepwatch_participant`: `service_ids ARRAY(BIGINT)` (null = not picked), `show_seen BOOLEAN`.

Write the migration under `goodwatch-webapp/app/server/yepwatch/migrations/` and regenerate `schema.sql`.

## Out of scope (follow-ups)

- Country from IP (needs a GeoIP data source decision). Until then: member prefill, then device locale.
- Swipe gestures stay as they are today in the voting card; restyle around them.

## Test plan

- Server: machine tests for every new command (host checks, no reset, retiring, interleaving, endless fallback, seen filter); proposal concurrency and relational Crate suites; regenerated `schema.sql`.
- Gateway: projection tests for the new shared fields.
- App: typecheck, lint, unit tests, browser tests; a multiplayer browser run (host + 2 friends: create, ideas on/off mid-vote, services merge, propose, agree, Tonight, start again).
- Release: fingerprint matches build 16 on both platforms before the OTA publish.

## Reviewer findings adopted (Fable, 2026-11-01)

- Shared with the room: idea authors and each person's services ("who brings which service"). Not shared: proposer and approvers. The proposal screen has no face row; it shows "Someone proposes" (or "Your proposal") and "2 of 3 agree".
- "Keep swiping" dismissal keys on the proposal version, so a new proposal shows again.
- A match or proposal on a title that leaves the deck (service switched off, idea off) is withdrawn.
- Ideas are records (`doc.yepwatch_idea`); candidates store `ideaIds`. Retired unanswered cards leave `seenKeys` so they can return.
- The host can't switch off the last enabled service while voting.
- One paid search per idea add/edit (outside the write retry loop), with a per-room budget.
- Release order: Crate DDL → push to main (GoodWatch webapp and the YepWatch stack deploy) → OTA immediately once healthy. Rolling back means server and OTA together: build 16's embedded bundle can't read the new snapshot.
