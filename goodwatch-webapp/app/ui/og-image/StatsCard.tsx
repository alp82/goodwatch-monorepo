// The card of GoodWatch in numbers (/stats): four of the page's numbers stacked on ink, large amber figures with their
// words after them in white, and an amber strip on the right with the wordmark and "Stats". Each line's words sit on
// the figure's baseline and take the largest size that fits beside it; words that don't fit at the smallest size
// switch to their short form (server/og-image/stats-content.server.ts).
import { STATS_CARD_COPY as COPY } from "~/ui/og-image/copy"
import {
	AMBER,
	Brand,
	Frame,
	HEIGHT,
	INK,
	WIDTH,
	col,
	row,
	runWidth,
} from "~/ui/og-image/parts"

export interface OgStatsLine {
	n: string
	words: string
	/** Shorter words for when `words` doesn't fit beside the number. */
	short?: string
}

export interface OgStatsContent {
	kind: "stats"
	lines: OgStatsLine[]
}

const SIDE = 56
const STRIP = 330
const GAP = 22
const NUMBER_SIZE = 118
// Room for the line, short of the strip.
const LINE_WIDTH = WIDTH - STRIP - SIDE - 30
const WORDS = { max: 58, min: 34 }
// Anton's descent at the number's size minus at the words' size, roughly: lifts the words onto the number's baseline.
const BASELINE_LIFT = 8
// The strip's inside width: "Stats" and the line under it both span it.
const STRIP_INNER = STRIP - 2 * 36
// Gabarito Bold "Updated every day." at this size is about the strip's inside width (checked in the rendered card).
const UPDATED_SIZE = 29
// runWidth keeps a 3% margin, so "Stats" sized by it falls short of the line; this takes it back.
const STRIP_WORD_SIZE = Math.floor(
	(STRIP_INNER / runWidth(COPY.strip.toUpperCase(), 100)) * 100 * 1.03,
)

const anton = (text: string, size: number, color: string) => (
	<div
		style={{
			display: "flex",
			fontFamily: "Anton",
			fontSize: size,
			lineHeight: 0.95,
			letterSpacing: 1,
			color,
		}}
	>
		{text.toUpperCase()}
	</div>
)

/** The words and their size: the largest that fits beside the number, else the short form. */
export function fitWords(line: OgStatsLine): { text: string; size: number } {
	const room = LINE_WIDTH - runWidth(line.n.toUpperCase(), NUMBER_SIZE) - GAP
	const fit = (text: string) => {
		for (let size = WORDS.max; size >= WORDS.min; size -= 2)
			if (runWidth(text.toUpperCase(), size) <= room) return size
		return null
	}
	const size = fit(line.words)
	if (size !== null || !line.short)
		return { text: line.words, size: size ?? WORDS.min }
	return { text: line.short, size: fit(line.short) ?? WORDS.min }
}

export function StatsCard({ content }: { content: OgStatsContent }) {
	return (
		<Frame bg={INK}>
			<div
				style={col({
					position: "absolute",
					left: SIDE,
					top: 0,
					height: HEIGHT,
					width: LINE_WIDTH,
					justifyContent: "center",
					gap: 18,
				})}
			>
				{content.lines.slice(0, 4).map((line) => {
					const words = fitWords(line)
					return (
						<div
							key={line.words}
							style={row({
								alignItems: "flex-end",
								gap: GAP,
								overflow: "hidden",
							})}
						>
							{anton(line.n, NUMBER_SIZE, AMBER)}
							<div style={{ display: "flex", paddingBottom: BASELINE_LIFT }}>
								{anton(words.text, words.size, "#fff")}
							</div>
						</div>
					)
				})}
			</div>
			<div
				style={col({
					position: "absolute",
					top: 0,
					right: 0,
					width: STRIP,
					height: HEIGHT,
					backgroundColor: AMBER,
					padding: "44px 36px",
					justifyContent: "space-between",
				})}
			>
				<Brand dark size={44} />
				<div style={col({ gap: 14 })}>
					{anton(COPY.strip, STRIP_WORD_SIZE, INK)}
					<div
						style={{
							display: "flex",
							fontSize: UPDATED_SIZE,
							fontWeight: 700,
							color: INK,
							whiteSpace: "nowrap",
						}}
					>
						{COPY.updated}
					</div>
				</div>
			</div>
		</Frame>
	)
}
