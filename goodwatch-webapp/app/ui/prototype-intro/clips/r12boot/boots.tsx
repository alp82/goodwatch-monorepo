// PROTOTYPE - throwaway. Round 12 turn-on variants for the owner to choose from (beside r12's boot-soft). All are
// calm: no flash, no hard line. Each ends on the GoodWatch wordmark held with a slow push-in for the deal into the
// chat. All four are plain markup and CSS, so each could also run as the start page's CSS-only boot (painted before
// hydration, no script).
import type { CSSProperties } from "react"
import {
	BROWSER_FONT_FAMILY,
	GoodWatchG,
	GoodWatchWordmark,
	WORDMARK_WHITE,
	WORDMARK_YELLOW,
} from "~/ui/brand/GoodWatchWordmark"
import "~/ui/living-room/living-room.css"
import type { ClipProps } from "../../clip"
import "../r12boot.css"

export const BOOT_MS = { standby: 2800, iris: 2600, g: 2800, letters: 2700 }

const css = (v: Record<string, string | number>) => v as CSSProperties

/** (a) Standby: the TV's amber standby light breathes at the bottom, then the picture warms up from it. */
export function BootStandby(_p: ClipProps) {
	return (
		<div className="lpc-r12b lpc-r12b-standby">
			<div className="lpc-r12b-sb-glow" />
			<div className="lpc-r12b-sb-dot" />
			<div className="lpc-r12b-push">
				<div className="lpc-r12b-sb-mark">
					<GoodWatchWordmark gHeight={80} />
				</div>
			</div>
		</div>
	)
}

/** (b) Iris: a soft dark vignette opens from the middle onto a warm gradient and the wordmark. */
export function BootIris(_p: ClipProps) {
	return (
		<div className="lpc-r12b lpc-r12b-iris" style={css({ "--push": `${BOOT_MS.iris}ms` })}>
			<div className="lpc-r12b-ir-warm" />
			<div className="lpc-r12b-push">
				<div className="lpc-r12b-ir-mark">
					<GoodWatchWordmark gHeight={80} />
				</div>
			</div>
			<div className="lpc-r12b-ir-lid" />
		</div>
	)
}

/** (c) The G alone: the emblem turns in with an amber arc sweeping once around it, then "oodWatch" slides out. */
export function BootG(_p: ClipProps) {
	return (
		<div className="lpc-r12b lpc-r12b-g">
			<div className="lpc-r12b-g-glow" />
			<div className="lpc-r12b-push">
				<div className="lpc-r12b-g-lockup" style={{ fontFamily: BROWSER_FONT_FAMILY }}>
					<div className="lpc-r12b-g-emblem">
						<svg className="lpc-r12b-g-arc" viewBox="0 0 100 100" aria-hidden="true">
							<circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="72 217" />
						</svg>
						<GoodWatchG height="0.7778em" className="lpc-r12b-g-mark" style={{ marginBottom: "0.16em" }} />
					</div>
					<div className="lpc-r12b-g-window">
						<div className="lpc-r12b-g-text">
							<span style={{ color: WORDMARK_WHITE }}>ood</span>
							<span style={{ color: WORDMARK_YELLOW }}>Watch</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

const LETTERS = [..."ood"].map((ch) => ({ ch, color: WORDMARK_WHITE })).concat([..."Watch"].map((ch) => ({ ch, color: WORDMARK_YELLOW })))

/** (d) Letters settle: the G and each letter fade up in turn with a slight rise while the tracking tightens. */
export function BootLetters(_p: ClipProps) {
	return (
		<div className="lpc-r12b lpc-r12b-letters" style={css({ "--push": `${BOOT_MS.letters}ms` })}>
			<div className="lpc-r12b-lt-horizon" />
			<div className="lpc-r12b-push">
				<div className="lpc-r12b-lt-lockup" style={{ fontFamily: BROWSER_FONT_FAMILY }}>
					<GoodWatchG height="0.7778em" className="lpc-r12b-lt-g" style={{ marginBottom: "0.16em" }} />
					<div className="lpc-r12b-lt-text">
						{LETTERS.map((l, i) => (
							<span
								key={i}
								className="lpc-r12b-lt-ch"
								style={css({ color: l.color, "--i": i + 1, "--dx": `${(i - 3.5) * 0.09}em` })}
							>
								{l.ch}
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
