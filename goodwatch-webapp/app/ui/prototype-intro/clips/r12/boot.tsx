// PROTOTYPE - throwaway. Round 12's turn-on: subtle and calm. The screen warms up with a soft amber glow from the
// middle (no bright CRT line), the wordmark rises in gently with the TV's G pop and letter reveal, then holds with a
// slow push-in for the deal into the chat. The same glow is the start page's CSS boot (landing.css lp-boot-flash).
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import "~/ui/prototype-landing/landing.css"
import "~/ui/living-room/living-room.css"
import type { ClipProps } from "../../clip"
import "../r12.css"

export const BOOT_SOFT_MS = 2700

export function BootSoft(_p: ClipProps) {
	return (
		<div className="lpc-r12-boot">
			<div className="lpc-r12-glow" />
			<div className="lpc-r12-push">
				<div className="lpc-r12-mark">
					<GoodWatchWordmark gHeight={80} className="lr-boot" gClassName="lr-boot-g" textClassName="lr-boot-letters" />
				</div>
			</div>
		</div>
	)
}
