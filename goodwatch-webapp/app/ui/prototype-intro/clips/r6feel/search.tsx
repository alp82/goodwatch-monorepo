// PROTOTYPE - throwaway. Chapter 5, "Search by feeling", round 6: the owner's pick (round 5's "top match takes the
// screen"), now opening with the phrase typing HUGE (round 5's "big" clip) while the Read-as chips appear as their
// words land, then the phrase gets out of the way and the top match takes the screen. Readings and results are the
// real ones in round 5's snapshot (r5feel.server.ts); no new search runs.
import type { CSSProperties } from "react"
import { ReadChip, Ring } from "../searchfilter/kit"
import type { ClipProps, IntroData } from "../../clip"
import { Missing, at, famous, img, liveChips, r5 } from "../r5feel/kit"

/** Which word of each phrase carries each chip of its real reading (copied from round 5's search clips). */
const TRIGGERS: Record<string, Record<string, string>> = {
	space: {
		wonder: "mind-blowing",
		novelty: "mind-blowing",
		futuristic: "space",
		contemporary_realism: "space",
		spectacle: "space",
		adrenaline: "adventure",
		world_immersion: "adventure",
		fast_pace: "adventure",
	},
	epic: {
		spectacle: "epic",
		warfare: "epic",
		fantasy: "fantasy",
		wonder: "fantasy",
		world_immersion: "fantasy",
		contemporary_realism: "fantasy",
		adrenaline: "adventure",
		violence: "adventure",
	},
}

/** Faster than round 5 (48 ms): the owner asked for quicker typing. */
const PER_CHAR = 44

function plan(data: IntroData, which: "space" | "epic", start: number) {
	const s = r5(data)?.searches[which]
	if (!s) return null
	const done = start + s.q.length * PER_CHAR
	const chips = liveChips(s, TRIGGERS[which], start, PER_CHAR, { wants: 4, avoids: 1 })
	const [top, ...rest] = famous(s.titles, 6, { perFranchise: 1 })
	const backdrop = data.pool.find((c) => c.title === top?.title)?.backdrop_path ?? null
	return { s, done, chips, top, rest, backdrop }
}

/**
 * The search kit's typing (same letter and caret classes), with each word kept whole: at this size the kit's
 * letter-by-letter boxes would break a word across lines ("adve / nture").
 */
function TypedWords({ text, start }: { text: string; start: number }) {
	const words = text.split(" ")
	let i = 0
	return (
		<span className="lpc-sf-typed" aria-label={text}>
			{words.map((w, wi) => {
				const letters = [...w].map((c) => {
					const n = i++
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
							key={n}
							className={`lpc-sf-ch ${n === text.length - 1 ? "lpc-sf-ch-last" : ""}`}
							style={{ "--d": `${start + n * PER_CHAR}ms`, "--pc": `${PER_CHAR}ms` } as CSSProperties}
							aria-hidden="true"
						>
							{c}
						</span>
					)
				})
				const space = wi < words.length - 1 ? i++ : -1
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: words of a fixed string
					<span key={wi}>
						<span className="lpc-r6feel-wordbox">{letters}</span>
						{space >= 0 && " "}
					</span>
				)
			})}
		</span>
	)
}

function Huge({
	q,
	start,
	done,
	chips,
	className = "",
	ms,
	leaveChips,
}: { q: string; start: number; done: number; chips: ReturnType<typeof liveChips>; className?: string; ms?: number; leaveChips?: number }) {
	return (
		<div className={`lpc-r6feel-huge ${className}`} style={ms === undefined ? undefined : at(ms)}>
			<div className="lpc-r6feel-quote">
				<span className="lpc-r6feel-mark">“</span>
				<TypedWords text={q} start={start} />
				<span className="lpc-r6feel-mark lpc-r5f-pop" style={at(done)}>
					”
				</span>
			</div>
			{/* With `leaveChips`, the big chips step away at that moment (the morph puts small ones under the field). */}
			<div className={leaveChips === undefined ? "" : "lpc-r6feel-chipsaway"} style={leaveChips === undefined ? undefined : at(leaveChips)}>
				<div className="lpc-r6feel-chips">
					{chips.map(({ chip, ms: m }) => (
						<ReadChip key={chip.text} chip={chip} ms={m} />
					))}
				</div>
			</div>
		</div>
	)
}

function Field({ q }: { q: string }) {
	return (
		<div className="lpc-sf-field">
			<svg viewBox="0 0 20 20" fill="currentColor" className="lpc-sf-glass" aria-hidden="true">
				<path
					fillRule="evenodd"
					d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
					clipRule="evenodd"
				/>
			</svg>
			<span className="text-[#f3f4f6]">{q}</span>
		</div>
	)
}

function MatchBackdrop({ path, ms }: { path: string | null; ms: number }) {
	if (!path) return null
	return (
		<div className="lpc-r6feel-bd" style={at(ms, { "--len": "1000ms" })}>
			<img src={img(path, "w1280")} alt="" className="lpc-r6feel-kb" style={at(ms)} />
			<div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,6,10,.9) 0, rgba(5,6,10,.35) 42%, rgba(5,6,10,.92) 100%)" }} />
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

// ---------------------------------------------------------------------------------------------------------------
// A. Huge, then the field. The phrase types huge with its chips; it leaves upward while the search field (same phrase,
// same chips) arrives at the top; the top match's backdrop fills the screen and its title lands big.
export const TAKEOVER_MS = 8600
export function SearchTakeover({ data }: ClipProps) {
	const p = plan(data, "space", 600)
	if (!p?.top) return <Missing />
	const lift = p.done + 1000
	const reveal = lift + 500
	return (
		<div className="lpc-r6feel lpc-r6feel-search">
			<MatchBackdrop path={p.backdrop} ms={reveal} />
			<div className="lpc-r6feel-leave" style={at(lift)}>
				<Huge q={p.s.q} start={600} done={p.done} chips={p.chips} />
			</div>
			<div className="lpc-r6feel-top lpc-r6feel-arrive" style={at(lift + 320)}>
				<Field q={p.s.q} />
				<div className="lpc-sf-readas">
					<span className="lpc-sf-readas-label">Read as</span>
					{p.chips.map(({ chip }) => (
						<ReadChip key={chip.text} chip={chip} ms={0} />
					))}
				</div>
			</div>
			<Match top={p.top} rest={p.rest} ms={reveal + 300} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. Huge, then shrinks into the field. The same phrase on screen the whole time: it shrinks up to the top and a field's
// outline grows around it; the chips go with it. Then the top match takes the screen.
export const MORPH_MS = 8600
export function SearchMorph({ data }: ClipProps) {
	const p = plan(data, "space", 600)
	if (!p?.top) return <Missing />
	const lift = p.done + 1000
	const reveal = lift + 700
	return (
		<div className="lpc-r6feel lpc-r6feel-search">
			<MatchBackdrop path={p.backdrop} ms={reveal} />
			<div className="lpc-r6feel-ring-out" style={at(lift + 450)} />
			<div className="lpc-r6feel-morph absolute inset-0 z-[5]" style={at(lift)}>
				<Huge q={p.s.q} start={600} done={p.done} chips={p.chips} leaveChips={lift - 50} />
			</div>
			<div className="lpc-r6feel-smallchips lpc-sf-readas">
				<span className="lpc-sf-readas-label lpc-r5f-fade" style={at(lift + 650)}>
					Read as
				</span>
				{p.chips.map(({ chip }, i) => (
					<ReadChip key={chip.text} chip={chip} ms={lift + 700 + i * 90} />
				))}
			</div>
			<Match top={p.top} rest={p.rest} ms={reveal + 300} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. The answers first, then the winner grows. The epic phrase types huge with its chips; it lifts, six famous answers
// deal in as a row; the first grows into the whole screen (its backdrop) while the others step aside.
export const GROW_MS = 9200
export function SearchGrow({ data }: ClipProps) {
	const p = plan(data, "epic", 600)
	if (!p?.top) return <Missing />
	const lift = p.done + 900
	const row = lift + 300
	const grow = row + 1700
	const all = [p.top, ...p.rest].slice(0, 6)
	return (
		<div className="lpc-r6feel lpc-r6feel-search">
			{/* The winner's backdrop grows from where its poster sits in the row (the first of six). */}
			{p.backdrop && (
				<div className="lpc-r6feel-grow" style={at(grow, { "--ox": "22%" })}>
					<img src={img(p.backdrop, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover" />
					<div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,6,10,.88) 0, rgba(5,6,10,.3) 45%, rgba(5,6,10,.92) 100%)" }} />
				</div>
			)}
			<div className="lpc-r6feel-morph absolute inset-0 z-[5]" style={at(lift)}>
				<Huge q={p.s.q} start={600} done={p.done} chips={p.chips} leaveChips={lift - 50} />
			</div>
			<div className="lpc-r6feel-smallchips lpc-r6feel-smallchips-bare lpc-sf-readas">
				{p.chips.map(({ chip }, i) => (
					<ReadChip key={chip.text} chip={chip} ms={lift + 600 + i * 90} />
				))}
			</div>
			<div className="lpc-r6feel-row">
				{all.map((t, i) => (
					<div key={t.key} className="lpc-r6feel-aside" style={at(grow - 100 + i * 60)}>
						<div className="lpc-r5f-result lpc-r5f-deal" style={at(row + i * 130)}>
							<div className="lpc-r5f-poster">
								<img src={img(t.poster, "w342")} alt="" />
							</div>
							<Ring score={t.score} className="lpc-r5f-ring" />
						</div>
					</div>
				))}
			</div>
			<Match top={p.top} rest={p.rest} ms={grow + 700} />
		</div>
	)
}
