# Hybrid decision contract 3

Base `f5e06a2b`, approved prototype `5c4e53cf`. Import `@goodwatch/yepwatch-contracts/proposal`; `continuous.ts` / contract 2 unchanged. New prefix `/api/yepwatch/v1/proposal`, separate `doc.yepwatch_room_v3`, cookie/credential namespace and `yepwatch:v3:revision` / `yepwatch:v3:activity`. New API 15992 / WS 4324 / web 8133 / Metro 8141. No old room/client reinterpretation; explicit `contractVersion: 3` admission. Existing common paths/attach/view/ticket/member DTO shapes are preserved under the new prefix; no issuer/refresh changes.

- Shared `matches:[{candidateId,averageYepMs:number|null}]`; no pick count or owners. `proposalVersion` is monotonic even when proposal becomes null. Shared `proposal:{candidateId,version,previousCandidateId,agreeCount,requiredCount,averageYepMs}|null`. No proposer or approver identity. Shared `agreement:{version,state:'none'|'checking'|'unavailable',error}` is the fresh-check attempt fence; Done includes `proposalVersion`.
- Own `agreement:{proposalVersion,agreed,revision,isProposer}` replaces own pick. Own votes additionally expose only the caller's `activeExposureMs` and `timingSource:'active_exposure'|'implied'|'unavailable'`.
- `propose{generation,expectedRosterVersion,expectedProposalVersion,candidateId}` moves the actor to that current shared match, dropping only that actor's other ins. Repeating a sole existing in is a no-op; the legacy proposal is the most popular match, ties by most recently added in. A settled tiebreak winner takes precedence. No UI navigation changes agreement.
- `agree{generation,expectedRosterVersion,expectedProposalVersion,candidateId,expectedOwnAgreementRevision,agreed:boolean}` explicitly agrees/withdraws for exactly that proposal/title. An unvoted late newcomer Agree implies Yep but NEVER exposure timing. Withdrawal retains Yep and measured timing. Changing a private Nope/undo invalidates the proposal, so it cannot be agreed after it is cleared.
- A late join preserves the proposal and existing approvals, adds a required participant with no answers/approval, removes no quorum member, and cancels any pending finalization. Proposal survives pending unknown newcomer votes; it is cleared by any Nope, or undo of a Yep by anyone who had Yep when proposed (including a newcomer who later Yep/Agreed then undoes). Missing viewing context prevents finalization. Returning to voting, away and disconnect never withdraw agreement or change quorum.
- When exactly one current match has everyone in, or a tiebreak settles, confirmed viewing screens allow the persisted checking state and fresh per-screen offer check/CAS. Join/withdraw/changed agreement candidate/Nope/undo fence a held check; unrelated ins do not restart it. An unavailable offer check removes everyone’s in on that title. No host finalize. Retry agreement requires both current checker and proposal versions.

## Quickest and duration

Vote adds OPTIONAL `activeExposureMs:number|null`, integer 0–1,200,000 ms. Client accumulates foreground time only while the exact own voting card is visible and interactive; excludes background, trailer, details, matches, app suspend and time while a vote outcome is uncertain. Use monotonic elapsed time, pause/resume the same candidate, never wall-clock first-seen-to-response or network latency. Preserve per-candidate accumulation locally if known; after reload missing measurement remains null (no guessed reconstruction). Above the bound report null, never clamp to a misleading fast value. No server verification of actual human attention is claimed.

Only explicit Yep with valid measurement contributes. Nope/undo clear that entry's timing; subsequent explicit Yep needs its current accumulated measurement. Proposal/Agree preserves an existing measured Yep, otherwise implies Yep with null timing. Aggregate arithmetic mean is available only for a current all-Yep match with valid explicit timing from EVERY current required participant. Missing, implied or incomplete-roster timing =>null, never0. No individual durations in shared/event data. Simulator defaults omit the field; bot pace/randomness/HTTP timing is not human exposure.

Candidate `viewingDuration:{minutes,scope:'movie'|'episode'}|null` uses actual movie runtime or canonical episode runtime only; unknown stays null. A show's average runtime cannot establish a specific episode duration. Client may conservatively rank Shortest among movies only and label episode durations separately; it must never compare unknown as0 or full-show length as an episode. Scores/runtimes are facts, not agreement. Dice and lenses inspect only.

## Ephemeral inspection

Existing neutral activity frame shape remains, plus `inspection:{kind:'poster',candidateId}|{kind:'lens'}|{kind:'dice'}`. Allowed only with view matches; poster ID must be in current shared.matches at sender and receiving gateway. Lens/dice omit candidate, type fields are exact. Activity is named/session-scoped as ordinary co-presence, never proposer/approver identity or agreement-triggered metadata. A pending late-join proposal that is not yet a current match has no poster-target inspection; use generic matches presence. No timing, vote direction/value, current voting card, coordinates or approval metadata. Existing TTL/rate limits stay.

### Matches: I'm in and favorites (`matchesIn`)

`set_in { generation: number, candidateId: string, in: boolean, expectedOwnInRevision: number }`
adds/removes one current match from the actor's multi-select. Changed values increment the actor's revision
and the room's `inVersion`; repeated values are no-ops after checking the revision fence. A true value supplies
an implied Yep when needed. `pick_favorite { generation: number, tiebreakVersion: number, candidateId: string | null }`
sets or withdraws one favorite until the tiebreak outcome is set. All three commands require the choosing phase.
For a pending late-join proposal still in the eligible candidate pool, `set_in` with `in: true` also supplies the joiner's implied Yep and in even before it is a current match, without confirming or deciding; `in: false` still requires a current match.

Clients declare `?matchesIn=1` on HTTP requests, or `matchesIn: true` in realtime authenticate. Without this
capability shared `ins`, `inVersion`, `tiebreak`, and own `ins`, `favorite` are omitted. The capability is
independent of `candidateReasons`. Internal realtime reads and committed invalidations always retain the fields.
The installed app's shared parser is strict; its HTTP own reads are typed rather than schema parsed. Own fields
are gated too, keeping one capability for the complete feature.

Shared fields (optional on the wire for compatibility):
- `ins: { candidateId: string; count: number }[]`: every current match in match order, **including zero counts**.
- `inVersion: number`: monotonic; increments on changed ins/counts, including roster/match reconciliation.
- `tiebreak: { version: number; candidateIds: string[]; favorites: { candidateId: string; count: number }[];
  seed?: string; outcome: { candidateId: string; spun: boolean; among: string[] } | null } | null`.

Own fields (also optional without capability):
- `ins: { candidateIds: string[]; revision: number }`.
- `favorite: { tiebreakVersion: number; candidateId: string | null } | null`.

Only active seats contribute. Joins/rejoins start with no ins/favorite; departures drop selections from counts.
Taps only change ins. `confirm_in { generation: number, inVersion: number }` confirms the current everyone-in set:
one title starts the fresh offer check; two or more open a tiebreak. A stale version or empty set conflicts.
Changing the everyone-in set clears confirmation and closes its check/tiebreak; re-adding requires confirmation again.
Repeated confirmation preserves a running check/tiebreak; confirming a failed single-title check retries it.
Legacy `propose`/`agree` implicitly confirm a sole everyone-in title.
An unchanged tied set keeps its version/seed/picks; a changed set gets a new monotonic version and random 16-hex
seed, clearing picks. Every new tiebreak advances the persisted inVersion, even after closing on a roster change. The seed is omitted until outcome is set. Roster changes also re-evaluate a pending outcome. Every active seat must pick before
settlement: most picks wins, with ties in tiebreak order resolved by unsigned UTF-16 FNV-1a of
`seed + ":" + among.join(",")`, modulo `among.length`.

The existing `decision.proposalVersion: number` is retained. `proposalVersion` increments when counts change
or an outcome changes. The offer-check fence depends on the agreement candidate and its real inputs, so
unrelated ins do not retry unavailable checks. The legacy proposal projects the tiebreak winner, otherwise
the most ins (positive counts only; ties by most recent in), otherwise a pending late-join proposal.
The decision and legacy proposal always name the same title. Old `agree` can supply the missing Yep.
`propose(X)` moves only the actor's ins to X; `agree` toggles that proposal title, and `own.agreement`
reflects the actor's in for that title.

Conflicts: `set_in` invalid phase/generation/match → `Pick a current match`; stale actor revision →
`Your I'm in changed`; invalid/closed/completed tiebreak, generation, version or favorite → `The tiebreak changed`.
A final decision remains historical across later roster changes. If its tied set no longer has everyone in,
snapshots omit that obsolete tiebreak (`null`) and own favorite while retaining the final decision.

Internal realtime calls also require `?matchesIn=1` for these fields. Both API/gateway deployment orders work; gateway first is preferred.
