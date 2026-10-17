// "Search": a phrase types itself huge while the chips of its real reading appear as their words land, then it lifts
// into a one-line search field and the top match takes the screen, with one title per franchise beside it.
import type { CSSProperties } from "react"
import {
	Missing,
	at,
	famous,
	feelData,
	img,
	liveChips,
} from "~/ui/living-room/intro/parts/feeling-kit"
import { onePerFranchise } from "~/ui/living-room/intro/parts/franchise"
import { ReadChip, Ring } from "~/ui/living-room/intro/parts/search-kit"
import type { IntroData, SceneProps } from "~/ui/living-room/intro/scene"

/** Which word of the phrase carries each chip of its real reading. */
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
	const s = feelData(data)?.searches.space
	if (!s) return null
	const done = START + s.q.length * PER_CHAR
	// One row: four things it reads into the phrase, nothing it avoids.
	const chips = liveChips(s, TRIGGERS, START, PER_CHAR, { wants: 4, avoids: 0 })
	// One title per franchise (TMDB collection, else the name), in the search's own order.
	const [top, ...rest] = onePerFranchise(
		data,
		famous(s.titles, 40, { perFranchise: 9 }),
		6,
	)
	const backdrop =
		data.pool.find((c) => c.title === top?.title)?.backdrop_path ?? null
	return { s, done, chips, top, rest, backdrop }
}

/** The phrase typing letter by letter, on one line (the search kit's letter and caret classes). */
function Typed({ text, start }: { text: string; start: number }) {
	return (
		<span className="intro-search-typed intro-mood-typed" aria-label={text}>
			{[...text].map((c, n) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
					key={n}
					className={`intro-search-ch ${n === text.length - 1 ? "intro-search-ch-last" : ""}`}
					style={
						{
							"--d": `${start + n * PER_CHAR}ms`,
							"--pc": `${PER_CHAR}ms`,
						} as CSSProperties
					}
					aria-hidden="true"
				>
					{c === " " ? " " : c}
				</span>
			))}
		</span>
	)
}

const Glass = ({ className }: { className: string }) => (
	<svg
		viewBox="0 0 20 20"
		fill="currentColor"
		className={className}
		aria-hidden="true"
	>
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
		<div className="intro-mood-field">
			<Glass className="intro-mood-glass" />
			<span className="intro-mood-q">{q}</span>
			<span className="intro-mood-caret" aria-hidden="true" />
		</div>
	)
}

function Chips({
	chips,
	live,
}: { chips: ReturnType<typeof liveChips>; live: boolean }) {
	return (
		<div className="intro-mood-chips">
			<span className="intro-mood-readas">Read as</span>
			{chips.map(({ chip, ms }) => (
				<ReadChip key={chip.text} chip={chip} ms={live ? ms : 0} />
			))}
		</div>
	)
}

type Top = {
	key: string
	title: string
	poster: string | null
	score: number | null
}

function Match({ top, rest, ms }: { top: Top; rest: Top[]; ms: number }) {
	return (
		<div className="intro-feel-match">
			<div className="intro-ask-deal" style={at(ms)}>
				<div className="intro-ask-kicker">Top match</div>
				<div className="intro-feel-match-title">{top.title}</div>
				<Ring score={top.score} className="intro-feel-ring mt-[1.4cqh]" />
			</div>
			<div className="intro-feel-rest">
				{rest.slice(0, 4).map((t, i) => (
					<div
						key={t.key}
						className="intro-ask-result intro-ask-deal"
						style={at(ms + 450 + i * 140)}
					>
						<div className="intro-ask-poster">
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
/** The phrase reads for 900 ms after its last letter, creeping toward the viewer. */
const READ = 900
/** The last result deals in at reveal + 300 + 450 + 3 × 140 (750 ms); the scene ends 1.1 s after it has landed. */
const tail = (reveal: number) => reveal + 300 + 450 + 3 * 140 + 750 + 1100
export function Search({ data }: SceneProps) {
	const p = plan(data)
	if (!p?.top) return <Missing />
	const lift = p.done + READ
	const reveal = lift + 450 // [500]
	const ms = tail(reveal)
	// The huge phrase's size: up to 8cqw while it fits 88cqw on one line (Gabarito bold ≈ 0.5em a letter).
	const size = Math.min(8, 88 / (p.s.q.length * 0.5 + 1))
	return (
		<div className="intro-feel intro-feel-search">
			{p.backdrop && (
				<div
					className="intro-feel-bd"
					style={at(reveal, { "--len": "1000ms" })}
				>
					<img
						src={img(p.backdrop, "w1280")}
						alt=""
						className="intro-feel-kb intro-tempo-kb"
						style={at(reveal, { "--kbl": `${ms - reveal}ms` })}
					/>
					<div
						className="absolute inset-0"
						style={{
							background:
								"linear-gradient(180deg, rgba(5,6,10,.9) 0, rgba(5,6,10,.35) 42%, rgba(5,6,10,.92) 100%)",
						}}
					/>
				</div>
			)}
			<div className="intro-feel-leave" style={at(lift)}>
				{/* While the finished phrase reads, it creeps toward the viewer. */}
				<div
					className="intro-tempo-hold"
					style={at(p.done - 300, {
						"--dur": `${READ + 300 + 400}ms`,
						"--hs": 1.035,
					})}
				>
					<div
						className="intro-mood-huge"
						style={{ "--size": `${size}cqw` } as CSSProperties}
					>
						<div className="intro-mood-line">
							<span className="intro-feel-mark">“</span>
							<Typed text={p.s.q} start={START} />
							<span
								className="intro-feel-mark intro-ask-pop"
								style={at(p.done)}
							>
								”
							</span>
						</div>
						<Chips chips={p.chips} live />
					</div>
				</div>
			</div>
			<div className="intro-mood-top intro-feel-arrive" style={at(lift + 250)}>
				<Field q={p.s.q} />
				<Chips chips={p.chips} live={false} />
			</div>
			<Match top={p.top} rest={p.rest} ms={reveal + 300} />
		</div>
	)
}
