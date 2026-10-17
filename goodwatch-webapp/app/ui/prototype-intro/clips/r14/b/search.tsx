// PROTOTYPE - throwaway. Round 14: search-native-r9 with one result per franchise (no three Star Wars).
// PROTOTYPE - throwaway. Chapter 5, "Search by feeling", round 9: round 7's search-native, retimed. Typing starts
// at 250 ms instead of 600 (the quote marks are there from the first frame); while the finished phrase reads it creeps
// toward the viewer instead of standing still; the field and the top match arrive with less wait; the backdrop drifts
// until the clip ends, which is about 1.1 s after the last result lands (the last 800 ms under the crossfade).
// Round 7's header: round 6's "huge phrase, then the field" with the
// owner's fixes. Nothing breaks across lines: the huge phrase is sized to fit one line, the search field is one line and
// looks like the site's header search (navigation/Search.tsx: the white-glass pill, the amber glass, the thin rim),
// and the Read-as chips sit in one row (only what the search reads into the phrase, not what it avoids).
// Readings and results are the real ones in round 5's snapshot (r5feel.server.ts); no new search runs.
import type { CSSProperties } from "react"
import { ReadChip, Ring } from "../../searchfilter/kit"
import type { ClipProps, IntroData } from "../../../clip"
import { Missing, at, famous, img, liveChips, r5 } from "../../r5feel/kit"
import { onePerFranchise } from "./franchise"

/** Which word of the phrase carries each chip of its real reading (round 5's mapping). */
const TRIGGERS: Record<string, string> = {
	wonder: "mind-blowing",
	novelty: "mind-blowing",
	futuristic: "space",
	contemporary_realism: "space",
	spectacle: "space",
	adrenaline: "adventure",
	world_immersion: "adventure",
	fast_pace: "adventure",
}

const PER_CHAR = 44
const START = 250 // [600]

function plan(data: IntroData) {
	const s = r5(data)?.searches.space
	if (!s) return null
	const done = START + s.q.length * PER_CHAR
	// One row: four things it reads into the phrase, nothing it avoids.
	const chips = liveChips(s, TRIGGERS, START, PER_CHAR, { wants: 4, avoids: 0 })
	// Round 14: one title per franchise (TMDB collection, else the name), in the search's own order.
	const [top, ...rest] = onePerFranchise(data, famous(s.titles, 40, { perFranchise: 9 }), 6)
	const backdrop = data.pool.find((c) => c.title === top?.title)?.backdrop_path ?? null
	return { s, done, chips, top, rest, backdrop }
}

/** The phrase typing letter by letter, on one line (the search kit's letter and caret classes). */
function Typed({ text, start }: { text: string; start: number }) {
	return (
		<span className="lpc-sf-typed lpc-r7feel-typed" aria-label={text}>
			{[...text].map((c, n) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
					key={n}
					className={`lpc-sf-ch ${n === text.length - 1 ? "lpc-sf-ch-last" : ""}`}
					style={{ "--d": `${start + n * PER_CHAR}ms`, "--pc": `${PER_CHAR}ms` } as CSSProperties}
					aria-hidden="true"
				>
					{c === " " ? " " : c}
				</span>
			))}
		</span>
	)
}

const Glass = ({ className }: { className: string }) => (
	<svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
		<path
			fillRule="evenodd"
			d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
			clipRule="evenodd"
		/>
	</svg>
)

/** The header's search pill at TV size, holding the phrase on one line with a resting caret. */
function Field({ q }: { q: string }) {
	return (
		<div className="lpc-r7feel-field">
			<Glass className="lpc-r7feel-glass" />
			<span className="lpc-r7feel-q">{q}</span>
			<span className="lpc-r7feel-caret" aria-hidden="true" />
		</div>
	)
}

function Chips({ chips, live }: { chips: ReturnType<typeof liveChips>; live: boolean }) {
	return (
		<div className="lpc-r7feel-chips">
			<span className="lpc-r7feel-readas">Read as</span>
			{chips.map(({ chip, ms }) => (
				<ReadChip key={chip.text} chip={chip} ms={live ? ms : 0} />
			))}
		</div>
	)
}

type Top = { key: string; title: string; poster: string | null; score: number | null }

function Match({ top, rest, ms }: { top: Top; rest: Top[]; ms: number }) {
	return (
		<div className="lpc-r6feel-match">
			<div className="lpc-r5f-deal" style={at(ms)}>
				<div className="lpc-r5f-kicker">Top match</div>
				<div className="lpc-r6feel-match-title">{top.title}</div>
				<Ring score={top.score} className="lpc-r6feel-ring mt-[1.4cqh]" />
			</div>
			<div className="lpc-r6feel-rest">
				{rest.slice(0, 4).map((t, i) => (
					<div key={t.key} className="lpc-r5f-result lpc-r5f-deal" style={at(ms + 450 + i * 140)}>
						<div className="lpc-r5f-poster">
							<img src={img(t.poster, "w342")} alt="" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

/**
 * Huge phrase, then the field. The phrase types huge on one line, its chips appearing in one row as their words land.
 * Then it leaves upward as the native search field (same phrase, same chips) settles at the top, and the top match's
 * backdrop takes the screen.
 */
/** The phrase reads for 900 ms after its last letter (round 7: 1000 ms, standing still). */
const READ = 900
/** The last result deals in at reveal + 300 + 450 + 3 × 140 (750 ms); the clip ends 1.1 s after it has landed. */
const tail = (reveal: number) => reveal + 300 + 450 + 3 * 140 + 750 + 1100
export const searchR14Ms = (data: IntroData) => {
	const p = plan(data)
	return p ? tail(p.done + READ + 450) : 6500
}
export function SearchR14({ data }: ClipProps) {
	const p = plan(data)
	if (!p?.top) return <Missing />
	const lift = p.done + READ
	const reveal = lift + 450 // [500]
	const ms = tail(reveal)
	// The huge phrase's size: as big as round 6's (8cqw) while it fits 88cqw on one line (Gabarito bold ≈ 0.5em a letter).
	const size = Math.min(8, 88 / (p.s.q.length * 0.5 + 1))
	return (
		<div className="lpc-r6feel lpc-r6feel-search">
			{p.backdrop && (
				<div className="lpc-r6feel-bd" style={at(reveal, { "--len": "1000ms" })}>
					<img src={img(p.backdrop, "w1280")} alt="" className="lpc-r6feel-kb lpc-r9a-kb" style={at(reveal, { "--kbl": `${ms - reveal}ms` })} />
					<div
						className="absolute inset-0"
						style={{ background: "linear-gradient(180deg, rgba(5,6,10,.9) 0, rgba(5,6,10,.35) 42%, rgba(5,6,10,.92) 100%)" }}
					/>
				</div>
			)}
			<div className="lpc-r6feel-leave" style={at(lift)}>
				{/* While the finished phrase reads, it creeps toward the viewer. */}
				<div className="lpc-r9a-hold" style={at(p.done - 300, { "--dur": `${READ + 300 + 400}ms`, "--hs": 1.035 })}>
				<div className="lpc-r7feel-huge" style={{ "--size": `${size}cqw` } as CSSProperties}>
					<div className="lpc-r7feel-line">
						<span className="lpc-r6feel-mark">“</span>
						<Typed text={p.s.q} start={START} />
						<span className="lpc-r6feel-mark lpc-r5f-pop" style={at(p.done)}>
							”
						</span>
					</div>
					<Chips chips={p.chips} live />
				</div>
				</div>
			</div>
			<div className="lpc-r7feel-top lpc-r6feel-arrive" style={at(lift + 250)}>
				<Field q={p.s.q} />
				<Chips chips={p.chips} live={false} />
			</div>
			<Match top={p.top} rest={p.rest} ms={reveal + 300} />
		</div>
	)
}
