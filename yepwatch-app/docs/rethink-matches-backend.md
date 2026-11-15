# Rethink Matches: backend handoff

Spec item 6 (`docs/rethink.md`): on Matches people tap **every** match they're in for (multi-select), everyone in
for one title decides it, and everyone in for two or more gets a tiebreak (everyone picks a favorite, most picks
wins, a spin decides when favorites tie). The app side is built (`src/features/room/Decide.tsx` Matches,
`src/features/room/Tiebreak.tsx`, `src/features/room/matches-in.ts`). The server can't express it today. This is
what it needs.

## What the server supports today (contract 3)

- One proposal per room (`shared.proposal`: `candidateId`, `version`, `agreeCount`, `requiredCount`) with one
  agreement per person (`own.agreement`: `proposalVersion`, `agreed`, `revision`, `isProposer`).
- `propose { generation, expectedRosterVersion, expectedProposalVersion, candidateId }` replaces the proposal and
  **clears every agreement** (`clearApprovals`, `proposal-machine.ts`); the proposer counts as agreed.
- `agree { …, candidateId, expectedOwnAgreementRevision, agreed }` agrees or takes it back. Everyone agreeing
  (plus everyone's Yep, `agreementCandidate`) starts the offer check (`agreement.state = "checking"`), then
  `phase = "decided"` with `decision`.

### How the app maps "I'm in" onto it until the server changes (`matches-in.ts`)

- Tap on the proposal's title: `agree(!mine)`.
- Tap on another title while nobody else is in on the proposal: `propose(title)` (nothing of anyone else's is lost;
  your old title stays marked on this device).
- Otherwise: marked on this device only (shown as "You're in", counted for you alone), so a tap never wipes
  friends' agreements.
- Your own proposal no longer takes over your screen (`showsProposal`); a friend's still does ("Someone's in").
- Consequence: only one title at a time collects real "I'm in"s, so the tiebreak never opens today.

## What to add

### Commands (`packages/yepwatch-contracts/proposal.ts` `RoomCommand`, `proposal-validation.ts`, `proposal-machine.ts`)

```ts
| { type: "set_in"; generation: number; candidateId: string; in: boolean; expectedOwnInRevision: number }
| { type: "pick_favorite"; generation: number; tiebreakVersion: number; candidateId: string | null }
```

`set_in`
- `phase === "choosing"`, `generation` current, `candidateId` a current shared match (`matches(room)`), else
  `conflict` ("Pick a current match").
- Idempotent per value; bumps the actor's `inRevision` on every change; `expectedOwnInRevision` fences a stale
  device (409 `conflict`, "Your I'm in changed").
- `in: true` also records an implied Yep (as `agree` does today: `value: "watch"`, `timingSource: "implied"`),
  so a late joiner's I'm in keeps the title a match.
- Per person, any number of titles. Limit: at most the room's match cap (512), no extra limit needed.
- After applying, recompute `everyoneIn` = matches every active participant is in for (in match order):
  - exactly one → start the existing agreement check on it (reuse `agreement` / offer recheck / `decision`), with
    `decision.proposalVersion` replaced by a new `decision.inVersion` (or keep `proposalVersion` and bump it here).
  - two or more → open a tiebreak (below) if none is open for the same set; a different set closes the old one and
    opens a new one (new `version`, picks cleared).
  - zero → close any tiebreak.
- A participant leaving or joining (roster change) drops their ins from the count; a joiner starts with none, so an
  open tiebreak or a running check is re-evaluated (`reconcile`), as proposals are today.
- Keep `propose` / `agree` working for installed bundles: treat `propose(X)` as `set_in(X, true)` for the actor,
  and `agree(true|false)` on the proposal's title as `set_in(title, true|false)`. Stop clearing everyone's ins on
  `propose` (that was the single-proposal model). Keep projecting `proposal` for old bundles as the title with the
  most ins (ties: match order), `agreeCount` = its in count.

`pick_favorite`
- Only while a tiebreak is open and `tiebreakVersion` matches (409 `conflict`, "The tiebreak changed").
- `candidateId` one of the tiebreak's titles, or `null` to take the pick back (until the outcome is set).
- One favorite per person. When every active participant has picked: most picks wins; favorites tied → spin:
  `among` = the most-picked titles in tiebreak order, winner = `among[hash(seed + ":" + among.join(",")) % among.length]`
  with the FNV-1a hash in `matches-in.ts` (`tieOutcome`) so every phone animates to the same title. Then start the
  agreement check on the winner exactly as for a single everyone-in title.

### Shared snapshot (`SharedRoomSnapshot`, counts only, never who)

```ts
ins: { candidateId: string; count: number }[]          // every current match, match order (count 0 included or omitted: pick one, document it)
inVersion: number                                      // monotonic, bumps on every set_in that changes a count
tiebreak: {
  version: number                                      // bumps when the tied set changes
  candidateIds: string[]                               // everyone's in for these, match order (2+)
  favorites: { candidateId: string; count: number }[]  // picks so far, counts only
  seed: string                                         // random per tiebreak version (server-chosen, e.g. 16 hex chars)
  outcome: { candidateId: string; spun: boolean; among: string[] } | null
} | null
```

### Own snapshot (`OwnPrivateSnapshot`)

```ts
ins: { candidateIds: string[]; revision: number }
favorite: { tiebreakVersion: number; candidateId: string | null } | null
```

### Realtime projection (`yepwatch-realtime/src/proposal-projection.ts`, strict zod)

Add to `proposalSharedSchema`:

```ts
ins: z.array(z.strictObject({ candidateId: id, count })).max(512),
inVersion: count,
tiebreak: z.strictObject({
  version: count,
  candidateIds: z.array(id).min(2).max(512),
  favorites: z.array(z.strictObject({ candidateId: id, count })).max(512),
  seed: z.string().min(8).max(64),
  outcome: z.strictObject({ candidateId: id, spun: z.boolean(), among: z.array(id).min(1).max(512) }).nullable(),
}).nullable(),
```

and checks in `proposalProjection`: every `ins[].candidateId` is a current match and `count <= required`; every
`tiebreak.candidateIds` entry has `count === required` in `ins`; favorites' counts sum to at most `required`;
`outcome.candidateId` is in `outcome.among`, which is a subset of `candidateIds`; `phase === "setup"` has no ins and
no tiebreak. The app's own `sharedSchema` (`yepwatch-app/src/core/continuous/wire.ts`, strict) needs the same
fields, or new snapshots fail to parse in installed bundles: ship the app's schema first (fields optional), then
the server.

### Storage (Crate)

- Per person: `ins` (candidate ids), `inRevision`, `favorite` go in the serialized participant record
  (`participant_records`), no DDL.
- Room: `inVersion` and the tiebreak (`version`, `candidateIds`, `favorites` are derived from participants, `seed`,
  `outcome`) as a new `tiebreak_record TEXT` column next to `proposal_record` plus `in_version BIGINT`: DDL for the
  orchestrator to apply after a snapshot.

### Reads after a live update (`?known=`)

`ins` and `tiebreak` are shared; the actor's own `ins` / `favorite` are in `own`, so the shared/own split holds.

## App wiring once the server ships

- `model.ts`: add `cmd.setIn(candidateId, in)` and `cmd.pickFavorite(candidateId)` (version fences from the latest
  snapshot, as `agree` does), optimistic in `core/continuous/optimistic.ts` (`set_in` adjusts the own list and the
  shared count by one).
- `matches-in.ts`: when `shared.ins` exists, rows come from it (`count`) and `own.ins` (`mine`), and every tap is
  `set_in`; the proposal fallback and device-only marks go away.
- `Decide.tsx` Matches: pass `shared.tiebreak` to `<Tiebreak>` (`favorites`, `mine` from `own.favorite`, `seed`),
  open it by itself when a tiebreak appears, `onPick` → `pickFavorite`. Leave `onWatch` out: the server decides
  the winner and the room moves to Tonight.
- Update `tests/glow-browser/room-fake.ts` (`set_in`, `pick_favorite`) and `e2e/web/decide.spec.ts` (two people
  in for two titles → tiebreak → spin → Tonight).
