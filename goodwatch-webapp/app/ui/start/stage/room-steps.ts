// How a guest's room lights up step by step (docs/implementation/start-page-redesign.md, "The camera and the night").
// The night over the room is an opacity (0 lit) and the camera a scale on the room's box, so only opacity and
// transform ever animate (start.css has the transitions).
//
// - Step 0, ask: nothing asked yet. The room is nearly dark and seen close up.
// - Step 1, pick: the guest asked. Each loved title lights the room a little more and pulls the camera back; mood picks
//   start it lighter, so their color grade shows.
// - Step 2, For you: three loved and the picks are on show. The room is lit at its normal framing.
//
// Pure, so the numbers are tested (room-steps.test.ts).

export type RoomStep = 0 | 1 | 2

export type RoomLight = { night: number; camera: number }

/** A member's room: lit, at its normal framing. */
export const LIT_ROOM: RoomLight = { night: 0, camera: 1 }

/** Before a guest asks: nearly dark, close up. */
export const DARK_ROOM: RoomLight = { night: 0.9, camera: 1.12 }

/** Which step a guest is on. */
export function roomStep({
	asked,
	picksShown,
}: {
	/** The guest asked (Enter, Search, a preset, the picker's Done, or leaving the field with a search on). */
	asked: boolean
	/** Three are loved and their picks (or the word that there are none) are on show. */
	picksShown: boolean
}): RoomStep {
	if (picksShown) return 2
	return asked ? 1 : 0
}

const round = (v: number) => Math.round(v * 1000) / 1000

/** The room's night and camera on a step. `loved` counts the loved titles (0 to 3), `moods` whether any is picked. */
export function roomLight(
	step: RoomStep,
	{ loved, moods }: { loved: number; moods: boolean },
): RoomLight {
	if (step === 0) return DARK_ROOM
	if (step === 2) return LIT_ROOM
	const n = Math.max(0, Math.min(3, loved))
	return {
		night: round(Math.max(0.16, (moods ? 0.42 : 0.55) - 0.12 * n)),
		camera: round(1.07 - 0.017 * n),
	}
}
