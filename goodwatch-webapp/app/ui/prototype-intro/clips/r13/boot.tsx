// PROTOTYPE - throwaway. The owner's boot (round 13): the G turns in while a thin amber arc sweeps once around it,
// and during the sweep the TV's amber standby light breathes at the bottom of the screen; then "oodWatch" slides out
// of the G and the lockup holds with a slow push-in. Plain markup and CSS: the start page paints it before any script
// (prototype-landing/shared.tsx Boot), and the lab plays it as the film's first clip.
import type { CSSProperties } from "react"
import { BROWSER_FONT_FAMILY, GoodWatchG, WORDMARK_WHITE, WORDMARK_YELLOW } from "~/ui/brand/GoodWatchWordmark"
import "../r12boot.css"
import "../r13.css"

export const BOOT_FINAL_MS = 2800

export function BootGStandby({ k }: { k?: number }) {
	return (
		<div className="lpc-r12b lpc-r12b-g lpc-r13-boot" style={k ? ({ "--k": k } as CSSProperties) : undefined}>
			<div className="lpc-r12b-g-glow" />
			<div className="lpc-r12b-sb-dot lpc-r13-dot" />
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
