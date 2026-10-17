// PROTOTYPE - throwaway. The film's first moment: the TV turns on (a light line opens the picture) and the GoodWatch
// boot screen shows, the TV's own (ui/living-room/tv/kit.tsx Boot and the landing's lp-boot CRT flash). It holds the
// wordmark, gently pushing in, for the deal into the chat.
import type { CSSProperties } from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import "~/ui/prototype-landing/landing.css"
import "~/ui/living-room/living-room.css"
import type { ClipProps } from "../../clip"
import "../r11.css"

export const BOOT_TV_MS = 2600

export function BootTv(_p: ClipProps) {
	return (
		<div className="lpc-r11-boot" style={{ "--b": "1" } as CSSProperties}>
			<div className="lp-boot-flash lpc-r11-flash" />
			<div className="lpc-r11-mark">
				<GoodWatchWordmark gHeight={84} className="lr-boot" gClassName="lr-boot-g" textClassName="lr-boot-letters" />
			</div>
		</div>
	)
}
