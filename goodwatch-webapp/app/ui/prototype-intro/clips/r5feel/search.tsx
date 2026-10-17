// PROTOTYPE - throwaway. Chapter 5, "Search by feeling", round 5: mainstream phrases, faster typing, and the "Read as"
// chips arriving while the phrase types (each when the word that asks for it lands). Real readings and results: the
// site's own search, run once per phrase and kept on disk (r5feel.server.ts). Results show best known first.
import { ReadChip, Ring, Typed } from "../searchfilter/kit"
import type { ClipProps } from "../../clip"
import { Missing, Root, at, famous, img, liveChips, r5 } from "./kit"

/** Which word of each phrase carries each chip of its real reading (by fingerprint key, or the chip's text). */
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
	date: {
		"Date night": "night",
		"Partner watch": "date",
		bleakness: "funny",
		melancholy: "funny",
		situational_comedy: "funny",
		wit_wordplay: "funny",
		showbiz: "night",
		dialogue_quality: "night",
	},
}

const PER_CHAR = 48

/** A poster with its score ring under it. */
function Result({ t, ms, ring = true }: { t: { title: string; poster: string | null; score: number | null }; ms: number; ring?: boolean }) {
	return (
		<div className="lpc-r5f-result lpc-r5f-deal" style={at(ms)}>
			<div className="lpc-r5f-poster">
				<img src={img(t.poster, "w342")} alt="" />
			</div>
			{ring && <Ring score={t.score} className="lpc-r5f-ring" />}
		</div>
	)
}

function Field({ q, start, big = false }: { q: string; start: number; big?: boolean }) {
	return (
		<div className={`lpc-sf-field lpc-r5f-field ${big ? "lpc-r5f-field-big" : ""}`}>
			<svg viewBox="0 0 20 20" fill="currentColor" className="lpc-sf-glass" aria-hidden="true">
				<path
					fillRule="evenodd"
					d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
					clipRule="evenodd"
				/>
			</svg>
			<Typed text={q} start={start} perChar={PER_CHAR} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// A. Live: the phrase types into the search field; the reading builds under it word by word; famous results deal in.
export const LIVE_MS = 7400
export function SearchLive({ data }: ClipProps) {
	const s = r5(data)?.searches.space
	if (!s) return <Missing />
	const start = 1000
	const done = start + s.q.length * PER_CHAR
	const chips = liveChips(s, TRIGGERS.space, start, PER_CHAR, { wants: 5, avoids: 1 })
	const results = famous(s.titles, 6)
	return (
		<Root className="lpc-r5f-search">
			<h2 className="lpc-r5f-head lpc-r5f-rise" style={at(0)}>
				Search by <em>feeling.</em>
			</h2>
			<div className="lpc-r5f-rise" style={at(400)}>
				<Field q={s.q} start={start} />
			</div>
			<div className="lpc-sf-readas lpc-r5f-readas lpc-r5f-rise" style={at(700)}>
				<span className="lpc-sf-readas-label">Read as</span>
				{chips.map(({ chip, ms }) => (
					<ReadChip key={chip.text} chip={chip} ms={ms} />
				))}
			</div>
			<div className="lpc-r5f-results">
				{results.map((t, i) => (
					<Result key={t.key} t={t} ms={done + 500 + i * 130} />
				))}
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. Big: the phrase types huge in the middle (round 4's favourite), the reading pops in under it as it goes, then it
// all lifts to make room for the results.
export const BIG_MS = 7800
export function SearchBig({ data }: ClipProps) {
	const s = r5(data)?.searches.epic
	if (!s) return <Missing />
	const start = 700
	const done = start + s.q.length * PER_CHAR
	const chips = liveChips(s, TRIGGERS.epic, start, PER_CHAR, { wants: 5, avoids: 1 })
	const results = famous(s.titles, 6, { perFranchise: 1 })
	const lift = done + 700
	return (
		<Root className="lpc-r5f-search lpc-r5f-big">
			<div className="lpc-r5f-lift" style={at(lift)}>
				<div className="lpc-r5f-quote">
					<span className="lpc-r5f-mark">“</span>
					<Typed text={s.q} start={start} perChar={PER_CHAR} />
					<span className="lpc-r5f-mark lpc-r5f-pop" style={at(done)}>
						”
					</span>
				</div>
				<div className="lpc-sf-readas lpc-r5f-readas justify-center">
					{chips.map(({ chip, ms }) => (
						<ReadChip key={chip.text} chip={chip} ms={ms} />
					))}
				</div>
			</div>
			<div className="lpc-r5f-results lpc-r5f-results-low">
				{results.map((t, i) => (
					<Result key={t.key} t={t} ms={lift + 350 + i * 130} />
				))}
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. Top result: fast typing, the reading builds, then the best-known match takes the screen with its backdrop and
// score, the next four small beside it.
export const TOP_MS = 7400
export function SearchTop({ data }: ClipProps) {
	const s = r5(data)?.searches.space
	if (!s) return <Missing />
	const start = 800
	const done = start + s.q.length * PER_CHAR
	const chips = liveChips(s, TRIGGERS.space, start, PER_CHAR, { wants: 4, avoids: 1 })
	const [top, ...rest] = famous(s.titles, 5)
	// The top result's backdrop: the pool's card when it is the pool's title (Interstellar, the hero).
	const backdrop = data.pool.find((c) => c.title === top?.title)?.backdrop_path ?? null
	const reveal = done + 450
	return (
		<Root className="lpc-r5f-search">
			{backdrop && (
				<div className="lpc-r5f-fade absolute inset-0" style={at(reveal, { "--len": "1100ms" })}>
					<img src={img(backdrop, "w1280")} alt="" className="lpc-r5f-kb absolute inset-0 h-full w-full object-cover" />
					<div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,6,10,.92) 0, rgba(5,6,10,.55) 45%, rgba(5,6,10,.9) 100%)" }} />
				</div>
			)}
			<div className="relative">
				<div className="lpc-r5f-rise" style={at(200)}>
					<Field q={s.q} start={start} />
				</div>
				<div className="lpc-sf-readas lpc-r5f-readas">
					{chips.map(({ chip, ms }) => (
						<ReadChip key={chip.text} chip={chip} ms={ms} />
					))}
				</div>
			</div>
			{top && (
				<div className="relative mt-auto mb-[14cqh] flex items-end gap-[3cqw]">
					<div className="lpc-r5f-deal" style={at(reveal + 200)}>
						<div className="lpc-r5f-kicker">Top match</div>
						<div className="lpc-r5f-top-title">{top.title}</div>
						<div className="mt-[1cqh] flex items-center gap-[1.2cqw]">
							<Ring score={top.score} className="lpc-r5f-ring lpc-r5f-ring-big" />
						</div>
					</div>
					<div className="lpc-r5f-toprest ml-auto flex gap-[1.2cqw]">
						{rest.map((t, i) => (
							<Result key={t.key} t={t} ms={reveal + 700 + i * 140} ring={false} />
						))}
					</div>
				</div>
			)}
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// D. Exploration: ask like you'd ask a friend. The phrase is a message typed and sent; GoodWatch answers with what it
// heard (the reading) and three picks.
export const CHAT_MS = 7800
export function SearchChat({ data }: ClipProps) {
	const s = r5(data)?.searches.date
	if (!s) return <Missing />
	const start = 900
	const done = start + s.q.length * PER_CHAR
	const sent = done + 350
	const reply = sent + 700
	// Chips here come with the reply, all at once, in the order the search read them.
	const chips = liveChips(s, TRIGGERS.date, 0, 0, { wants: 4, avoids: 1 }).map(({ chip }, i) => ({ chip, ms: reply + 450 + i * 140 }))
	const picks = famous(s.titles, 3, { minScore: 70 })
	return (
		<Root className="lpc-r5f-search lpc-r5f-chat">
			<h2 className="lpc-r5f-head lpc-r5f-rise" style={at(0)}>
				Just <em>ask.</em>
			</h2>
			<div className="lpc-r5f-thread">
				<div className="lpc-r5f-bubble lpc-r5f-me lpc-r5f-send" style={at(sent)}>
					{s.q}
				</div>
				<div className="lpc-r5f-bubble lpc-r5f-gw lpc-r5f-deal" style={at(reply)}>
					<div className="lpc-r5f-gw-say">Sounds like:</div>
					<div className="lpc-sf-readas mt-[1cqh]">
						{chips.map(({ chip, ms }) => (
							<ReadChip key={chip.text} chip={chip} ms={ms} />
						))}
					</div>
					<div className="mt-[1.6cqh] flex gap-[1.2cqw]">
						{picks.map((t, i) => (
							<Result key={t.key} t={t} ms={reply + 1300 + i * 160} />
						))}
					</div>
				</div>
			</div>
			{/* The message field the phrase types into; it empties when the message is sent. */}
			<div className="lpc-r5f-compose lpc-r5f-rise" style={at(300)}>
				<div className="lpc-r5f-compose-text lpc-r5f-clear" style={at(sent)}>
					<Typed text={s.q} start={start} perChar={PER_CHAR} />
				</div>
				<span className="lpc-r5f-sendbtn lpc-r5f-press" style={at(sent - 120)}>
					↑
				</span>
			</div>
		</Root>
	)
}
