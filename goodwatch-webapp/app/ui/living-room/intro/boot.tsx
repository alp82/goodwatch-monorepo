// The boot screen the start page's TV shows as the page opens: the GoodWatch G turns in while a thin amber arc
// sweeps once around it and the TV's standby light breathes at the bottom; then "oodWatch" slides out of the G and the
// wordmark holds with a slow push-in. Plain markup and CSS (boot.css), in the server's HTML, so it plays from the first
// paint, before any script. It covers the TV's picture and fades out by itself after BOOT_MS.
import {
	BROWSER_FONT_FAMILY,
	GoodWatchG,
	WORDMARK_WHITE,
	WORDMARK_YELLOW,
} from "~/ui/brand/GoodWatchWordmark"

/** When the boot screen has faded out. */
export const BOOT_MS = 2850

export function Boot() {
	return (
		<div className="boot" aria-hidden="true">
			<div className="boot-glow" />
			<div className="boot-standby" />
			<div className="boot-push">
				<div
					className="boot-lockup"
					style={{ fontFamily: BROWSER_FONT_FAMILY }}
				>
					<div className="boot-emblem">
						<svg className="boot-arc" viewBox="0 0 100 100" aria-hidden="true">
							<circle
								cx="50"
								cy="50"
								r="46"
								fill="none"
								stroke="#fbbf24"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeDasharray="72 217"
							/>
						</svg>
						<GoodWatchG
							height="0.7778em"
							className="boot-g"
							style={{ marginBottom: "0.16em" }}
						/>
					</div>
					<div className="boot-window">
						<div className="boot-text">
							<span style={{ color: WORDMARK_WHITE }}>ood</span>
							<span style={{ color: WORDMARK_YELLOW }}>Watch</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
