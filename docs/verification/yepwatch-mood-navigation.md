# YepWatch mood continuity — 2026-11-11

The reported flicker reproduced as 21 animation frames without the original mood field during the entrance → room → mood handoff. A rejected interpretation also left the editor immediately, briefly showed its optimistic text in the room, then reverted to Anything with a catalog error.

## Navigation review and changes

| Smell | Change |
| --- | --- |
| Entrance, RoomHome, route parameters, a storage marker and a memory draft all decided when to open Mood | `/new` owns a local draft. Opening it does no room POST or interpretation. Only explicit Create submits. The editor stays mounted until the complete workflow succeeds. |
| Creating, retrying, opening and opened flags represented overlapping submission states | TanStack Query mutations own pending/success/error. `CreateRoom.save` hides admission, persistence, country setup, command recovery and confirmed cache publication behind one operation. The remaining room flag specifically controls the guest services offer. |
| Fallible interpretation text was displayed as if accepted | Add, edit and remove idea commands wait for confirmation. Errors stay beside the retained draft. Immediate voting and simple settings feedback remain supported. |
| Back assumed any prior route was the room | Room subpages dismiss to their explicit room destination; room exit targets the start page. Cancelling a new draft returns to its caller. An unfinished request never forces the start page back into its editor. |
| A retained room screen could publish a notice over its editor | Room notices publish only while their screen is focused. |
| The same editor was coupled to room admission and room context | `MoodComposer` only renders the form; `NewRoom` and `MoodPage` own their respective mutations. |

Keep Expo Router for native and web navigation. The existing TanStack Query mutation lifecycle represents this linear form without another state machine library. The existing durable command queue still supplies exact command IDs, sequence order, cooldowns and lost-response replay; a mutation alone does not replace those guarantees. TanStack Router or Form would add another owner without solving this defect.

State transitions: local draft → submitting → confirmed room; submitting → retained draft with error → manual retry. Navigation follows success. Leaving or backgrounding cancels automatic admission retries. The saved bootstrap and pending command survive reload until the entire workflow succeeds, so recovery cannot allocate a second room or add the same idea twice.

The room's durable setup/choosing/decision state machine and Jev spending limits are unchanged.

## Verification

Browser checks exercise the public screen/workflow interface with an isolated HTTP adapter. Coverage includes frame-by-frame field continuity at phone and desktop widths with motion enabled, local-only opening, refusal without rollback or duplicate notices, signed-in creation, exact bootstrap and command replay after reload, bounded country conflicts, storage failures, server cooldowns, cancellation, Back navigation, reconnects, starts, solo matching and multiplayer room journeys.

Run from `yepwatch-app`:

```sh
npm run typecheck
npm run lint
npm test
npx playwright test --workers=3
```

Library references: [Expo navigation](https://docs.expo.dev/router/basics/navigation/), [TanStack Query mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations). No dependencies or native modules were added.

Validation result: all 186 unit tests and the full 175-test browser suite passed. A final 21-test navigation pass covers the subsequent focus guard and fresh-draft cache fix, including the two added recovery/navigation cases. TypeScript passes; lint has zero errors and the existing unused `View` warning in legacy `Voting.tsx`. Native runtime fingerprints match the installed iOS beta and Android preview builds, so no native binary rebuild is required. Physical-device behavior is not claimed by browser checks.
