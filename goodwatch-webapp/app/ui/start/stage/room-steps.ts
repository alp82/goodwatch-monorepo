// How the start page's room is lit (docs/implementation/start-page-redesign.md, "The camera and the night"). The
// night over the room is an opacity (0 lit), so only opacity ever animates (start.css has the transition). The camera
// stays at its normal framing: the room never moves.
//
// - The room loads dim, and its lamp comes on a moment after the page has started (ledge/StartLedge.tsx, useLamp).
// - A guest's room is a little dimmed at rest; open, each loved title lights it more (mood picks start it lighter, so
//   their color grade shows), and it is fully lit once the picks are on show.
// - A member's room rests a little lighter, and is fully lit once the card is open.
//
// Pure, so the numbers are tested (room-steps.test.ts).

/** Before the lamp comes on. */
export const DIM_NIGHT = 0.55

const round = (v: number) => Math.round(v * 1000) / 1000

/** A guest's night. `loved` counts the loved titles (0 to 3), `moods` whether any is picked. */
export function guestNight({
	lamp,
	open,
	picksShown,
	loved,
	moods,
}: {
	lamp: boolean
	open: boolean
	/** Three are loved and their picks (or the word that there are none) are on show. */
	picksShown: boolean
	loved: number
	moods: boolean
}): number {
	if (!lamp) return DIM_NIGHT
	if (picksShown) return 0
	if (!open) return 0.32
	const n = Math.max(0, Math.min(3, loved))
	return round(Math.max(0.04, (moods ? 0.16 : 0.22) - 0.06 * n))
}

/** A member's night. */
export function memberNight({
	lamp,
	open,
}: { lamp: boolean; open: boolean }): number {
	if (!lamp) return DIM_NIGHT
	return open ? 0 : 0.28
}
