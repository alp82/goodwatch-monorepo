// PROTOTYPE - throwaway. Round 5 openers: "What should we watch?" turns into endless scrolling while the evening
// passes. Four ways to show the time going: an analog clock, night falling in the window, a phone's battery
// draining, and a stopwatch over a pile of no's. All timing is CSS, scaled by the stage's --k (../../clip.ts).
import type { CSSProperties, ReactNode } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps, IntroData } from "../../clip"

/** An inline delay, in ms at k = 1. */
const delay = (ms: number): CSSProperties => ({ animationDelay: `calc(${ms}ms * var(--k))` })
const vars = (v: Record<string, string | number>) => v as CSSProperties

const posters = (data: IntroData) => [...new Set(data.pool.flatMap((c) => c.poster_path ?? []))]
const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

const Root = ({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) => (
	<div className={`lpc-r5open ${className}`} aria-label={label}>
		{children}
	</div>
)

/** Words that land one after another. */
function Words({ words, from, step = 220, amber = [] as number[] }: { words: string[]; from: number; step?: number; amber?: number[] }) {
	return (
		<>
			{words.map((w, i) => (
				<span key={`${w}-${i}`}>
					<span className={`lpc-r5open-word lpc-r5open-in ${amber.includes(i) ? "lpc-r5open-amber" : ""}`} style={delay(from + i * step)}>
						{w}
					</span>
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The chat: real titles from the pool suggested and turned down.

const NO = ["Seen it twice.", "Too long to start now.", "Not in the mood.", "Too dark for tonight."]

function chatLines(data: IntroData, count = 3) {
	const picks = data.pool.slice(1).filter((c) => c.poster_path).slice(0, count)
	const lines: { me: boolean; text: string; poster?: string | null }[] = [{ me: false, text: "What should we watch?" }]
	picks.forEach((c, i) => {
		lines.push({ me: true, text: `${c.title}?`, poster: c.poster_path })
		lines.push({ me: false, text: NO[i % NO.length] })
	})
	return lines
}

/** Bubbles that pop in one by one from `from`, `step` apart; the thread climbs as it grows. */
function Chat({ data, from = 300, step = 560, count = 3, className = "" }: { data: IntroData; from?: number; step?: number; count?: number; className?: string }) {
	const lines = chatLines(data, count)
	return (
		<div className={`lpc-r5open-thread ${className}`}>
			{lines.map((l, i) => (
				<div key={i} className={`lpc-r5open-bubble ${l.me ? "lpc-r5open-me" : "lpc-r5open-you"}`} style={delay(from + i * step)}>
					{l.poster && <img src={tmdbImageUrl(l.poster, "w92")} alt="" />}
					<span>{l.text}</span>
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The wall: rows of posters drifting sideways, tilted.

function Wall({ data, rows = 4, className = "", style }: { data: IntroData; rows?: number; className?: string; style?: CSSProperties }) {
	const all = posters(data)
	return (
		<div className={`lpc-r5open-wall ${className}`} style={style} aria-hidden="true">
			<div className="lpc-r5open-tilt">
				{Array.from({ length: rows }, (_, i) => {
					const strip = rotate(all, i * 7)
					return (
						<div key={i} className={`lpc-r5open-strip ${i % 2 ? "lpc-r5open-rev" : ""}`}>
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

// ---------------------------------------------------------------------------------------------------------------
// Time devices

/**
 * A clock face whose hands sweep from `from` to `to` (hours, 24 h, e.g. 20 → 23.07) over `d` ms from `at`.
 * The minute hand turns once per hour; the hour hand moves its share.
 */
function AnalogClock({ from, to, at, d, className = "" }: { from: number; to: number; at: number; d: number; className?: string }) {
	const h0 = (from % 12) * 30
	const h1 = (to % 12) * 30
	const m0 = (from % 1) * 360
	const m1 = m0 + (to - from) * 360
	const style = vars({ "--at": `${at}ms`, "--d": `${d}ms`, "--h0": `${h0}deg`, "--h1": `${h1}deg`, "--m0": `${m0}deg`, "--m1": `${m1}deg` })
	return (
		<svg viewBox="-50 -50 100 100" className={`lpc-r5open-analog ${className}`} style={style} aria-hidden="true">
			<circle r="47" className="lpc-r5open-face" />
			{Array.from({ length: 12 }, (_, i) => (
				<line key={i} x1="0" y1={i % 3 ? -40 : -37} x2="0" y2="-44" transform={`rotate(${i * 30})`} className={i % 3 ? "lpc-r5open-tick" : "lpc-r5open-tick lpc-r5open-tick-big"} />
			))}
			<line x1="0" y1="6" x2="0" y2="-24" className="lpc-r5open-hand lpc-r5open-hour" />
			<line x1="0" y1="8" x2="0" y2="-36" className="lpc-r5open-hand lpc-r5open-min" />
			<circle r="3.2" className="lpc-r5open-pin" />
		</svg>
	)
}

/** A digital time that flips through `times` in equal steps over `d` ms from `at`; the last one stays. */
function Ticker({ times, at, d, className = "" }: { times: string[]; at: number; d: number; className?: string }) {
	const step = d / Math.max(1, times.length - 1)
	return (
		<span className={`lpc-r5open-ticker ${className}`}>
			<span className="lpc-r5open-ticker-size" aria-hidden="true">
				{times.reduce((a, b) => (b.length > a.length ? b : a), "")}
			</span>
			{times.map((t, i) => (
				<span
					key={t}
					className={i === 0 ? "lpc-r5open-flip-first" : i === times.length - 1 ? "lpc-r5open-flip-last" : "lpc-r5open-flip"}
					style={vars({ "--s": `${step}ms`, animationDelay: `calc(${at + i * step}ms * var(--k))` })}
				>
					{t}
				</span>
			))}
		</span>
	)
}

const EVENING = ["8:00 pm", "8:26 pm", "8:51 pm", "9:18 pm", "9:44 pm", "10:12 pm", "10:39 pm", "11:04 pm"]

// ---------------------------------------------------------------------------------------------------------------
// 1. The analog clock: chat, then the wall fades up behind it while the hands sweep three hours.

export function OpenerClock({ data }: ClipProps) {
	return (
		<Root label="What should we watch? Then endless scrolling, three hours pass">
			<Wall data={data} className="lpc-r5open-wall-up" style={delay(4300)} />
			<div className="lpc-r5open-veil lpc-r5open-fade" style={delay(4300)} />
			<div className="lpc-r5open-chatbox lpc-r5open-chat-out" style={delay(4200)}>
				<Chat data={data} />
			</div>
			<div className="lpc-r5open-clockbox lpc-r5open-in" style={delay(100)}>
				<AnalogClock from={20} to={23.07} at={400} d={8800} />
				<Ticker times={EVENING} at={400} d={8800} className="lpc-r5open-clocklabel" />
			</div>
			<div className="lpc-r5open-center lpc-r5open-center-down">
				<h2 className="lpc-r5open-big">
					<Words words={["Endless", "scrolling."]} from={6000} step={280} amber={[1]} />
				</h2>
				<p className="lpc-r5open-sub lpc-r5open-in" style={delay(7400)}>
					Three hours later, still nothing to watch.
				</p>
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Night falls: dusk in the window turns to night; the chat scrolls straight on into the endless wall.

export function OpenerNight({ data }: ClipProps) {
	return (
		<Root label="Night falls while the chat turns into endless scrolling" className="lpc-r5open-sky">
			<div className="lpc-r5open-night" style={delay(300)} />
			<div className="lpc-r5open-stars" style={delay(4000)} />
			<div className="lpc-r5open-sun" style={delay(200)} />
			<div className="lpc-r5open-moon" style={delay(3600)} />
			<div className="lpc-r5open-skytime lpc-r5open-in" style={delay(200)}>
				<Ticker times={["7:52 pm", "8:30 pm", "9:05 pm", "9:41 pm", "10:16 pm", "10:48 pm", "11:21 pm"]} at={400} d={8600} />
			</div>
			{/* The thumb keeps scrolling: the chat goes up and out, the wall comes up from below in one motion. */}
			<div className="lpc-r5open-chatbox lpc-r5open-scroll-off" style={delay(4300)}>
				<Chat data={data} />
			</div>
			<Wall data={data} rows={3} className="lpc-r5open-wall-low lpc-r5open-scroll-on" style={delay(4300)} />
			<div className="lpc-r5open-veil-low lpc-r5open-fade" style={delay(5600)} />
			<div className="lpc-r5open-center lpc-r5open-center-low">
				<h2 className="lpc-r5open-big">
					<Words words={["Another", "night,"]} from={6100} step={240} />
					<br />
					<Words words={["still", "scrolling."]} from={6600} step={240} amber={[1]} />
				</h2>
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// 3. The phone: the chat on a phone, its battery draining; the chat scrolls into a poster feed, then we fall into
// the screen and the feed fills the TV.

export function OpenerPhone({ data }: ClipProps) {
	const all = posters(data)
	return (
		<Root label="A phone's battery drains while the chat turns into endless scrolling">
			<Wall data={data} className="lpc-r5open-wall-up" style={delay(6600)} />
			<div className="lpc-r5open-veil lpc-r5open-fade" style={delay(6900)} />
			<div className="lpc-r5open-phone lpc-r5open-phone-dive" style={delay(6400)}>
				<div className="lpc-r5open-phone-bar">
					<Ticker times={["8:02", "8:47", "9:30", "10:14", "10:58"]} at={600} d={6000} />
					<span className="lpc-r5open-battery">
						<Ticker times={["92%", "71%", "48%", "23%", "8%"]} at={600} d={6000} className="lpc-r5open-pct" />
						<span className="lpc-r5open-cell">
							<span className="lpc-r5open-cell-fill" style={delay(600)}>
								<span className="lpc-r5open-cell-low" style={delay(4600)} />
							</span>
						</span>
					</span>
				</div>
				<div className="lpc-r5open-phone-screen">
					<div className="lpc-r5open-phone-chat lpc-r5open-scroll-off" style={delay(3900)}>
						<Chat data={data} from={500} step={480} count={2} />
					</div>
					<div className="lpc-r5open-feed lpc-r5open-scroll-on" style={delay(3900)}>
						<div className="lpc-r5open-feed-run" style={delay(3900)}>
							{[...all, ...all].slice(0, 48).map((p, i) => (
								<img key={`${p}-${i}`} src={tmdbImageUrl(p, "w154")} alt="" />
							))}
						</div>
					</div>
				</div>
			</div>
			<div className="lpc-r5open-center">
				<h2 className="lpc-r5open-big lpc-r5open-big-s">
					<Words words={["11 pm.", "8%", "battery."]} from={7300} step={240} />
					<br />
					<Words words={["Still", "nothing", "to", "watch."]} from={8000} step={180} amber={[1]} />
				</h2>
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Exploration: a stopwatch counts the time spent choosing; every rejected title lands on a pile, and the pile
// becomes a wall of no's.

export function OpenerStopwatch({ data }: ClipProps) {
	const lines = chatLines(data, 3)
	const rejected = lines.filter((l) => l.poster)
	const all = posters(data)
	return (
		<Root label="A stopwatch counts the evening spent choosing; a pile of rejected titles grows">
			<div className="lpc-r5open-nos" aria-hidden="true">
				{all.slice(0, 40).map((p, i) => (
					<span key={p} className="lpc-r5open-no lpc-r5open-deal" style={vars({ animationDelay: `calc(${4300 + (i % 20) * 45 + Math.floor(i / 20) * 120}ms * var(--k))` })}>
						<img src={tmdbImageUrl(p, "w154")} alt="" />
						<i>✕</i>
					</span>
				))}
			</div>
			<div className="lpc-r5open-veil lpc-r5open-fade" style={delay(5000)} />
			<div className="lpc-r5open-chatbox lpc-r5open-chat-right lpc-r5open-chat-out" style={delay(4100)}>
				<Chat data={data} />
			</div>
			<div className="lpc-r5open-pile lpc-r5open-chat-out" style={delay(4100)} aria-hidden="true">
				{rejected.map((l, i) => (
					<span key={i} className="lpc-r5open-toss" style={vars({ animationDelay: `calc(${300 + (i * 2 + 1) * 560 + 700}ms * var(--k))`, "--r": `${[-8, 6, -3][i]}deg` })}>
						<img src={tmdbImageUrl(l.poster as string, "w185")} alt="" />
						<i>✕</i>
					</span>
				))}
			</div>
			<div className="lpc-r5open-watch lpc-r5open-in" style={delay(100)}>
				<span className="lpc-r5open-watch-label">Time spent choosing</span>
				<Ticker times={["0:00", "0:21", "0:48", "1:12", "1:39", "2:05", "2:31", "2:47"]} at={400} d={8200} className="lpc-r5open-watch-time" />
			</div>
			<div className="lpc-r5open-center">
				<h2 className="lpc-r5open-big">
					<Words words={["All", "evening."]} from={6200} step={260} />
					<br />
					<Words words={["Nothing", "to", "watch."]} from={6800} step={200} amber={[0]} />
				</h2>
			</div>
		</Root>
	)
}
