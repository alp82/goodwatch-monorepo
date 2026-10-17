// PROTOTYPE - throwaway. Round 7 opener, refined from round 6's opener-receipts. Owner: "a time under every.
// perfect messaging. great pacing, nice wall. the native chat looks baaaad though. the name above takes needed
// screen estate and it just looks awful. cant see the previous question when the answer flies in". So the messages,
// their small times, the pacing and the wall stay; the chat loses its app chrome (no name, no avatar, no message
// field, no window): only the bubbles, larger, floating on the TV. And the thread climbs so each suggestion and its
// answer are on screen together when the answer lands. All timing is CSS, scaled by the stage's --k (../../clip.ts).
import type { CSSProperties, ReactNode } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps, IntroData } from "../../clip"

/** An inline delay, in ms at k = 1. */
const delay = (ms: number): CSSProperties => ({ animationDelay: `calc(${ms}ms * var(--k))` })
const vars = (v: Record<string, string | number>) => v as CSSProperties

const posters = (data: IntroData) => [...new Set(data.pool.flatMap((c) => c.poster_path ?? []))]
const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

const Root = ({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) => (
	<div className={`lpc-r7open ${className}`} aria-label={label}>
		{children}
	</div>
)

/** Words that land one after another. */
function Words({ words, from, step = 240, amber = [] as number[] }: { words: string[]; from: number; step?: number; amber?: number[] }) {
	return (
		<>
			{words.map((w, i) => (
				<span key={`${w}-${i}`}>
					<span className={`lpc-r7open-word lpc-r7open-in ${amber.includes(i) ? "lpc-r7open-amber" : ""}`} style={delay(from + i * step)}>
						{w}
					</span>
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</>
	)
}

/** The closing line, the same in every variant; only the small line under it changes. */
function Tagline({ from, sub }: { from: number; sub: string }) {
	return (
		<div className="lpc-r7open-center">
			<h2 className="lpc-r7open-big">
				<Words words={["Deciding", "is", "hard."]} from={from} amber={[2]} />
			</h2>
			<p className="lpc-r7open-sub lpc-r7open-in" style={delay(from + 1000)}>
				{sub}
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The chat: a messaging app's thread. Suggestions come as link previews of real, famous titles; each is turned down.

const NO = ["Seen it twice.", "Eight seasons? Tonight?", "Too heavy for tonight."]

const meta = (c: LandingCard) => {
	const kind = c.media_type === "movie" ? "Movie" : "TV show"
	const time = c.media_type === "movie" && c.runtime ? ` · ${Math.floor(c.runtime / 60)}h ${String(c.runtime % 60).padStart(2, "0")}m` : ""
	return `${kind}${c.release_year ? ` · ${c.release_year}` : ""}${time}`
}

/** Three famous titles with a picture: the first a movie, then a show, then a movie, as people suggest them. */
function suggestions(data: IntroData) {
	const ok = data.pool.slice(1).filter((c) => c.backdrop_path && c.poster_path)
	const movies = ok.filter((c) => c.media_type === "movie")
	const shows = ok.filter((c) => c.media_type === "show")
	return [movies[0], shows[0], movies[1]].filter(Boolean) as LandingCard[]
}

type Row =
	| { kind: "sep"; text: string; at: number }
	| { kind: "them" | "me"; text: string; at: number; time?: string; typing?: boolean }
	| { kind: "card"; card: LandingCard; at: number; time?: string }
	| { kind: "read"; text: string; at: number }

/** The thread's rows, at their times. `times` gives each message's small time (variant C) or none. */
function chatRows(data: IntroData, { separators, times }: { separators: boolean; times: boolean }): Row[] {
	const [a, b, c] = suggestions(data)
	const t = (s: string) => (times ? s : undefined)
	const rows: Row[] = []
	if (separators) rows.push({ kind: "sep", text: "Today 8:02 PM", at: 150 })
	rows.push({ kind: "them", text: "What are we watching tonight?", at: 350, time: t("8:02 PM") })
	if (a) rows.push({ kind: "card", card: a, at: 1150, time: t("8:19 PM") })
	rows.push({ kind: "them", text: NO[0], at: 1900, typing: true, time: t("8:23 PM") })
	if (separators) rows.push({ kind: "sep", text: "9:14 PM", at: 2600 })
	if (b) rows.push({ kind: "card", card: b, at: 2800, time: t("9:14 PM") })
	rows.push({ kind: "them", text: NO[1], at: 3550, typing: true, time: t("9:31 PM") })
	if (separators) rows.push({ kind: "sep", text: "10:47 PM", at: 4250 })
	if (c) rows.push({ kind: "card", card: c, at: 4450, time: t("10:47 PM") })
	rows.push({ kind: "them", text: NO[2], at: 5200, typing: true, time: t("10:52 PM") })
	if (!times) rows.push({ kind: "read", text: "Read 10:52 PM", at: 5500 })
	return rows
}

function Bubble({ row }: { row: Extract<Row, { kind: "them" | "me" }> }) {
	return (
		<div className={`lpc-r7open-row lpc-r7open-row-${row.kind}`}>
			{row.typing && (
				<span className="lpc-r7open-typing" style={vars({ animationDelay: `calc(${row.at - 650}ms * var(--k))` })} aria-hidden="true">
					<i />
					<i />
					<i />
				</span>
			)}
			<div className={`lpc-r7open-bubble lpc-r7open-${row.kind} lpc-r7open-pop`} style={delay(row.at)}>
				{row.text}
			</div>
			{row.time && (
				<span className="lpc-r7open-time lpc-r7open-fadein" style={delay(row.at + 250)}>
					{row.time}
				</span>
			)}
		</div>
	)
}

/** A suggestion as a link preview: the picture, the name, what it is. Sent by "me", so on the right. */
function Card({ row }: { row: Extract<Row, { kind: "card" }> }) {
	const c = row.card
	return (
		<div className="lpc-r7open-row lpc-r7open-row-me">
			<div className="lpc-r7open-card lpc-r7open-pop" style={delay(row.at)}>
				<img src={tmdbImageUrl(c.backdrop_path ?? "", "w300")} alt="" />
				<span className="lpc-r7open-card-text">
					<b>{c.title}</b>
					<span>{meta(c)}</span>
				</span>
			</div>
			<div className="lpc-r7open-bubble lpc-r7open-me lpc-r7open-attached lpc-r7open-pop" style={delay(row.at + 120)}>
				This one?
			</div>
			{row.time && (
				<span className="lpc-r7open-time lpc-r7open-fadein" style={delay(row.at + 300)}>
					{row.time}
				</span>
			)}
		</div>
	)
}

/**
 * The thread: rows appear in place; `climbs` lift the whole thread at given times, as a real chat moves up when the
 * next message arrives (row heights are fixed in cqh, so the amounts are known).
 */
function Thread({ rows, climbs }: { rows: Row[]; climbs: { at: number; to: number }[] }) {
	// One keyframe animation per climb, layered: each moves the thread from the previous height to the next.
	return (
		<div className="lpc-r7open-view">
			{climbs.reduce<ReactNode>(
				(inner, c, i) => (
					<div
						className="lpc-r7open-climb"
						style={vars({ "--to": `calc(${-(c.to - (climbs[i - 1]?.to ?? 0))} * var(--u))`, animationDelay: `calc(${c.at}ms * var(--k))` })}
					>
						{inner}
					</div>
				),
				<div className="lpc-r7open-thread">
					{rows.map((r, i) =>
						r.kind === "sep" ? (
							<div key={i} className="lpc-r7open-sep lpc-r7open-fadein" style={delay(r.at)}>
								{r.text}
							</div>
						) : r.kind === "read" ? (
							<div key={i} className="lpc-r7open-read lpc-r7open-fadein" style={delay(r.at)}>
								{r.text}
							</div>
						) : r.kind === "card" ? (
							<Card key={i} row={r} />
						) : (
							<Bubble key={i} row={r} />
						),
					)}
				</div>,
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The wall: rows of posters drifting sideways, tilted (round 5's, unchanged in spirit).

function Wall({ data, rows = 4, className = "", style }: { data: IntroData; rows?: number; className?: string; style?: CSSProperties }) {
	const all = posters(data)
	return (
		<div className={`lpc-r7open-wall ${className}`} style={style} aria-hidden="true">
			<div className="lpc-r7open-tilt">
				{Array.from({ length: rows }, (_, i) => {
					const strip = rotate(all, i * 7)
					return (
						<div key={i} className={`lpc-r7open-strip ${i % 2 ? "lpc-r7open-rev" : ""}`}>
							{[...strip, ...strip].map((p, j) => (
								<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" />
							))}
						</div>
					)
				})}
			</div>
		</div>
	)
}

// The thread lifts just before a row would fall below the view, and always far enough that the suggestion and its
// answer are both in view when the answer lands. Rows have fixed heights in --u (r7open.css): a bubble with its
// time 9, a link preview with its bubble and time 24, gaps 1.4, top padding 1.6. VIEW is the view's height in --u.
// Row tops: question 1.6, card 12, answer 37.4, card 47.8, answer 73.2, card 83.6, answer 109; each answer is 9 tall.
// Each climb puts the coming answer's bottom 2u above the view's bottom, so its card sits right above it.
const VIEW = 47
const CLIMBS = [
	{ at: 2650, to: 82.2 - VIEW + 2 },
	{ at: 4300, to: 118 - VIEW + 2 },
]

/**
 * Round 6's receipts opener without the app chrome: each message carries its own small time, so the gaps tell the
 * story. Then the thumb keeps scrolling: the chat goes up and out and the wall comes up in the same motion.
 */
export function OpenerChat({ data }: ClipProps) {
	return (
		<Root label="What are we watching tonight? Hours between the messages, then endless scrolling. Deciding is hard.">
			<Wall data={data} className="lpc-r7open-scroll-on" style={delay(5800)} />
			<div className="lpc-r7open-veil lpc-r7open-fadein" style={delay(6400)} />
			<div className="lpc-r7open-window lpc-r7open-scroll-off" style={delay(5800)}>
				<div className="lpc-r7open-window-in lpc-r7open-rise" style={delay(0)}>
					<Thread rows={chatRows(data, { separators: false, times: true })} climbs={CLIMBS} />
				</div>
			</div>
			<Tagline from={7300} sub="So much to watch. Nothing to pick." />
		</Root>
	)
}
