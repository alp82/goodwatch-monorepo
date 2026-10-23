// Application emojis for GoodWatch scores. Discord text can't be colored, so a card shows the score's color as an app
// emoji next to the number. One emoji per vibe band, in the site's --color-vibe-* tokens (app/tailwind.css).
// Pure: the upload script (scripts/discord-emojis.ts) and the cards both import it.

/** The site's --color-vibe-* tokens for steps 10 to 100, the same as VIBE_COLORS in app/ui/og-image/parts.tsx. */
export const SCORE_EMOJI_COLORS: Record<number, string> = {
	1: "#991b1b",
	2: "#b91c1c",
	3: "#c2410c",
	4: "#d97706",
	5: "#ca8a04",
	6: "#a3a323",
	7: "#65a32d",
	8: "#16934a",
	9: "#15803d",
	10: "#166534",
}

/**
 * The band (1 to 10) of a displayed GoodWatch score (0 to 100). Matches the site's color step, floor(score / 10), so
 * 85 takes the vibe-80 green like the title page ring. Scores under 10 share band 1.
 */
export const scoreBand = (score: number) =>
	Math.min(10, Math.max(1, Math.floor(score / 10)))

export const scoreEmojiName = (score: number) => `GoodWatchScore${scoreBand(score)}`

export const SCORE_EMOJI_NAMES = Object.keys(SCORE_EMOJI_COLORS).map(
	(band) => `GoodWatchScore${band}`,
)

/** A filled rounded badge, 128 by 128, with a soft top light and a thin darker rim so it holds on light and dark. */
export function scoreEmojiSvg(band: number) {
	const color = SCORE_EMOJI_COLORS[band]
	if (!color) throw new Error(`Unknown score band ${band}`)
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
<defs><linearGradient id="light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect x="10" y="10" width="108" height="108" rx="30" fill="${color}"/>
<rect x="10" y="10" width="108" height="108" rx="30" fill="url(#light)"/>
<rect x="11.5" y="11.5" width="105" height="105" rx="28.5" fill="none" stroke="#000" stroke-opacity="0.2" stroke-width="3"/>
</svg>`
}
