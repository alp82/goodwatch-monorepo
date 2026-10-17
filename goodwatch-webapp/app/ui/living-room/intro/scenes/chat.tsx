// "Let's watch": a chat where two people try to agree on a film. Each message carries its own small time, so the
// evening passes; the thread grows from the bottom, as a real chat. Then the thumb keeps scrolling into an endless
// wall of posters: "Deciding is hard."
import type { CSSProperties, ReactNode } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { IntroData, SceneProps } from "~/ui/living-room/intro/scene"
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** An inline delay, in ms at k = 1. */
const delay = (ms: number): CSSProperties => ({
	animationDelay: `calc(${ms}ms * var(--k))`,
})
const vars = (v: Record<string, string | number>) => v as CSSProperties

const posters = (data: IntroData) => [
	...new Set(data.pool.flatMap((c) => c.poster_path ?? [])),
]
const rotate = <T,>(list: T[], by: number) =>
	list.length
		? [...list.slice(by % list.length), ...list.slice(0, by % list.length)]
		: list

const Root = ({
	children,
	label,
	className = "",
}: { children: ReactNode; label: string; className?: string }) => (
	<div className={`intro-chat ${className}`} aria-label={label}>
		{children}
	</div>
)

/** Words that land one after another. */
function Words({
	words,
	from,
	step = 240,
	amber = [] as number[],
}: { words: string[]; from: number; step?: number; amber?: number[] }) {
	return (
		<>
			{words.map((w, i) => (
				<span key={`${w}-${i}`}>
					<span
						className={`intro-chat-word intro-chat-in ${amber.includes(i) ? "intro-chat-amber" : ""}`}
						style={delay(from + i * step)}
					>
						{w}
					</span>
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</>
	)
}

/** The closing line. */
function Tagline({ from, sub }: { from: number; sub: string }) {
	return (
		<div className="intro-chat-center">
			<h2 className="intro-chat-big">
				<Words words={["Deciding", "is", "hard."]} from={from} amber={[2]} />
			</h2>
			<p className="intro-chat-sub intro-chat-in" style={delay(from + 1000)}>
				{sub}
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The chat: a messaging app's thread. Suggestions come as link previews of real, famous titles; each is turned down.

const NO = [
	"Seen it twice.",
	"Eight seasons? Tonight?",
	"Too heavy for tonight.",
]

const meta = (c: IntroCard) => {
	const kind = c.media_type === "movie" ? "Movie" : "TV show"
	const time =
		c.media_type === "movie" && c.runtime
			? ` · ${Math.floor(c.runtime / 60)}h ${String(c.runtime % 60).padStart(2, "0")}m`
			: ""
	return `${kind}${c.release_year ? ` · ${c.release_year}` : ""}${time}`
}

/** Three famous titles with a picture: the first a movie, then a show, then a movie, as people suggest them. */
function suggestions(data: IntroData) {
	const ok = data.pool.slice(1).filter((c) => c.backdrop_path && c.poster_path)
	const movies = ok.filter((c) => c.media_type === "movie")
	const shows = ok.filter((c) => c.media_type === "show")
	return [movies[0], shows[0], movies[1]].filter(Boolean) as IntroCard[]
}

type Row =
	| { kind: "sep"; text: string; at: number }
	| {
			kind: "them" | "me"
			text: string
			at: number
			time?: string
			typing?: boolean
	  }
	| { kind: "card"; card: IntroCard; at: number; time?: string }
	| { kind: "read"; text: string; at: number }

/** The thread's rows, at their times. `times` gives each message's small time. */
function chatRows(
	data: IntroData,
	{ separators, times }: { separators: boolean; times: boolean },
): Row[] {
	const [a, b, c] = suggestions(data)
	const t = (s: string) => (times ? s : undefined)
	const rows: Row[] = []
	if (separators) rows.push({ kind: "sep", text: "Today 8:02 PM", at: 150 })
	rows.push({
		kind: "them",
		text: "What are we watching tonight?",
		at: 350,
		time: t("8:02 PM"),
	})
	if (a) rows.push({ kind: "card", card: a, at: 1150, time: t("8:19 PM") })
	rows.push({
		kind: "them",
		text: NO[0],
		at: 1900,
		typing: true,
		time: t("8:23 PM"),
	})
	if (separators) rows.push({ kind: "sep", text: "9:14 PM", at: 2600 })
	if (b) rows.push({ kind: "card", card: b, at: 2800, time: t("9:14 PM") })
	rows.push({
		kind: "them",
		text: NO[1],
		at: 3550,
		typing: true,
		time: t("9:31 PM"),
	})
	if (separators) rows.push({ kind: "sep", text: "10:47 PM", at: 4250 })
	if (c) rows.push({ kind: "card", card: c, at: 4450, time: t("10:47 PM") })
	rows.push({
		kind: "them",
		text: NO[2],
		at: 5200,
		typing: true,
		time: t("10:52 PM"),
	})
	if (!times) rows.push({ kind: "read", text: "Read 10:52 PM", at: 5500 })
	return rows
}

function Bubble({ row }: { row: Extract<Row, { kind: "them" | "me" }> }) {
	return (
		<div className={`intro-chat-row intro-chat-row-${row.kind}`}>
			{row.typing && (
				<span
					className="intro-chat-typing"
					style={vars({ animationDelay: `calc(${row.at - 650}ms * var(--k))` })}
					aria-hidden="true"
				>
					<i />
					<i />
					<i />
				</span>
			)}
			<div
				className={`intro-chat-bubble intro-chat-${row.kind} intro-chat-pop`}
				style={delay(row.at)}
			>
				{row.text}
			</div>
			{row.time && (
				<span
					className="intro-chat-time intro-chat-fadein"
					style={delay(row.at + 250)}
				>
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
		<div className="intro-chat-row intro-chat-row-me">
			<div className="intro-chat-card intro-chat-pop" style={delay(row.at)}>
				<img src={tmdbImageUrl(c.backdrop_path ?? "", "w300")} alt="" />
				<span className="intro-chat-card-text">
					<b>{c.title}</b>
					<span>{meta(c)}</span>
				</span>
			</div>
			<div
				className="intro-chat-bubble intro-chat-me intro-chat-attached intro-chat-pop"
				style={delay(row.at + 120)}
			>
				This one?
			</div>
			{row.time && (
				<span
					className="intro-chat-time intro-chat-fadein"
					style={delay(row.at + 300)}
				>
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
function Thread({
	rows,
	climbs,
	start,
}: { rows: Row[]; climbs: { at: number; to: number }[]; start: number }) {
	// The thread starts pushed down by `start` (u), so its first row sits at the bottom. One keyframe animation per
	// climb, layered: each moves the thread up from the previous height to the next.
	return (
		<div className="intro-chat-view">
			<div style={{ transform: `translateY(calc(${start} * var(--u)))` }}>
				{climbs.reduce<ReactNode>(
					(inner, c, i) => (
						// biome-ignore lint/correctness/useJsxKeyInIterable: each wrapper holds the next, never siblings
						<div
							className="intro-chat-climb"
							style={vars({
								"--to": `calc(${-(c.to - (climbs[i - 1]?.to ?? 0))} * var(--u))`,
								animationDelay: `calc(${c.at}ms * var(--k))`,
							})}
						>
							{inner}
						</div>
					),
					<div className="intro-chat-thread">
						{rows.map((r, i) =>
							r.kind === "sep" ? (
								<div
									key={i}
									className="intro-chat-sep intro-chat-fadein"
									style={delay(r.at)}
								>
									{r.text}
								</div>
							) : r.kind === "read" ? (
								<div
									key={i}
									className="intro-chat-read intro-chat-fadein"
									style={delay(r.at)}
								>
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
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The wall: rows of posters drifting sideways, tilted.

function Wall({
	data,
	rows = 4,
	className = "",
	style,
}: {
	data: IntroData
	rows?: number
	className?: string
	style?: CSSProperties
}) {
	const all = posters(data)
	return (
		<div
			className={`intro-chat-wall ${className}`}
			style={style}
			aria-hidden="true"
		>
			<div className="intro-chat-tilt">
				{Array.from({ length: rows }, (_, i) => {
					const strip = rotate(all, i * 7)
					return (
						<div
							key={i}
							className={`intro-chat-strip ${i % 2 ? "intro-chat-rev" : ""}`}
						>
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

// Bottom-anchored, as a real chat. Rows have fixed heights in --u (intro.css): a bubble with its time 9, a link
// preview with its bubble and time 24, gaps 1.4, top padding 1.6; VIEW is the view's height in --u. Row bottoms:
// question 10.6, card 36, answer 46.4, card 71.8, answer 82.2, card 107.6, answer 118. The newest row's bottom sits
// BOTTOM u above the view's bottom. A suggestion and its answer arrive together (the answer's typing dots follow the
// card by 100 ms), so one climb per suggestion makes room for both: the card lands with its answer's slot below it.
const VIEW = 47
const BOTTOM = 2
const LINE = VIEW - BOTTOM
/** Where the thread starts: pushed down until the question's bottom sits on the line. */
const START = LINE - 10.6
/** Each climb lifts the thread so the coming answer's bottom sits on the line; `to` counts from the start. */
const CLIMBS = [
	{ at: 1150, to: 46.4 - 10.6 },
	{ at: 2800, to: 82.2 - 10.6 },
	{ at: 4450, to: 118 - 10.6 },
]

/**
 * The chat, bottom-anchored: each message carries its own small time, so the gaps tell the story. Then the thumb keeps scrolling: the chat goes up and out and the wall comes up in the same motion.
 */
export function OpenerChat({ data }: SceneProps) {
	return (
		<Root label="What are we watching tonight? Hours between the messages, then endless scrolling. Deciding is hard.">
			<Wall data={data} className="intro-chat-scroll-on" style={delay(5800)} />
			<div className="intro-chat-veil intro-chat-fadein" style={delay(6400)} />
			<div
				className="intro-chat-window intro-chat-scroll-off"
				style={delay(5800)}
			>
				<div className="intro-chat-window-in intro-chat-rise" style={delay(0)}>
					<Thread
						rows={chatRows(data, { separators: false, times: true })}
						climbs={CLIMBS}
						start={START}
					/>
				</div>
			</div>
			<Tagline from={7300} sub="So much to watch. Nothing to pick." />
		</Root>
	)
}

/** The tagline starts at 7300 ms; the frame pushes in slowly from there to the hand-over */
export const CHAT_MS = 10000

export function Chat(props: SceneProps) {
	return (
		<Push from={7300} dur={CHAT_MS - 7300} scale={1.035}>
			<OpenerChat {...props} />
		</Push>
	)
}
