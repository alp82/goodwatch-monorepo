// PROTOTYPE - throwaway. Round 9 rhythm pass of round 7's opener-bubbles (chapter 1). The owner called its messaging
// "perfect" and its pacing "great", so nothing moves in time; the measure only found the closing line standing still
// for its last 0.85 s. Now the whole frame pushes in slowly from the moment "Deciding is hard." starts, so the hold
// before the hand-over to the score is alive.
import type { ClipProps } from "../../clip"
import { OpenerChat } from "../r7open/opener"
import { Push } from "./kit"

/** The tagline starts at 7300 ms (r7open/opener.tsx); the clip's length stays round 7's. */
export const OPENER_R9_MS = 10000

export function OpenerBubblesR9(props: ClipProps) {
	return (
		<Push from={7300} dur={OPENER_R9_MS - 7300} scale={1.035}>
			<OpenerChat {...props} />
		</Push>
	)
}
