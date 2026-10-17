// PROTOTYPE - throwaway. The "problem" group's clips: four openers (the evening lost to choosing) and four sign-offs.
// All timing is CSS, scaled by the stage's --k; see ../../clip.ts.
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ClipProps, IntroData } from "../../clip"

/** A delay for `--at`, in ms at k = 1. */
const at = (ms: number) => ({ "--at": `${ms}ms` }) as CSSProperties
/** An inline delay for the shared `.lpc-pr-in` / `.lpc-pr-deal`. */
const delay = (ms: number): CSSProperties => ({ animationDelay: `calc(${ms}ms * var(--k))` })

const unique = <T,>(list: T[]) => [...new Set(list)]
const posters = (data: IntroData) =>
	unique([...data.startTitles.flatMap((t) => t.poster_path ?? []), ...data.landing.flatMap((c) => c.poster_path ?? [])])
const rotate = <T,>(list: T[], by: number) => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : list)

/** Words that land one after another. */
function Words({ words, from, step = 180, amber = [] as number[] }: { words: string[]; from: number; step?: number; amber?: number[] }) {
	return (
		<>
			{words.map((w, i) => (
				<span key={`${w}-${i}`}>
					<span className={`lpc-pr-word lpc-pr-in ${amber.includes(i) ? "lpc-pr-amber" : ""}`} style={delay(from + i * step)}>
						{w}
					</span>
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</>
	)
}

/** A clock that rolls through five times, one step at a time. */
function Clock({ times, from, d }: { times: string[]; from: number; d: number }) {
	return (
		<span className="lpc-pr-clock">
			<span style={{ ...at(from), "--d": `${d}ms` } as CSSProperties}>
				{times.map((t) => (
					<span key={t}>{t}</span>
				))}
			</span>
		</span>
	)
}

const Root = ({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) => (
	<div className={`lpc-pr ${className}`} aria-label={label}>
		{children}
	</div>
)

// ---------------------------------------------------------------------------------------------------------------
// Openers

/** E's wall, slower and calmer: four rows drift, the wall leans in, the evening passes on a clock. */
export function OpenerScroll({ data }: ClipProps) {
	const all = posters(data)
	return (
		<Root label="Endless scrolling">
			<div className="lpc-pr-wall" aria-hidden="true">
				{[0, 1, 2, 3].map((i) => {
					const strip = rotate(all, i * 5)
					return (
						<div key={i} className={`lpc-pr-strip ${i % 2 ? "lpc-pr-rev" : ""}`}>
							{[...strip, ...strip].map((p, j) => (
								<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" />
							))}
						</div>
					)
				})}
			</div>
			<div className="lpc-pr-veil" />
			<div className="lpc-pr-center">
				<h2 className="lpc-pr-big">
					<Words words={["Endless", "scrolling."]} from={500} step={260} />
				</h2>
				<div className="lpc-pr-pill lpc-pr-in" style={delay(1300)}>
					<Clock times={["8:12 pm", "8:40 pm", "9:15 pm", "10:03 pm", "10:58 pm"]} from={1500} d={4600} />
					<span className="lpc-pr-wide">and still nothing to watch</span>
				</div>
			</div>
		</Root>
	)
}

/** "What should we watch?": a chat piles up, real titles suggested and turned down, then the question stays. */
export function OpenerChat({ data }: ClipProps) {
	const titles = data.startTitles.filter((t) => t.poster_path).slice(0, 3)
	const no = ["Seen it.", "Too long.", "Not in the mood."]
	const lines: { me: boolean; text: string; poster?: string | null }[] = [{ me: false, text: "What should we watch?" }]
	titles.forEach((t, i) => {
		lines.push({ me: true, text: `${t.title}?`, poster: t.poster_path })
		lines.push({ me: false, text: no[i] })
	})
	return (
		<Root label="What should we watch?">
			<div className="lpc-pr-chat" aria-hidden="true">
				<div className="lpc-pr-thread">
					{lines.map((l, i) => (
						<div key={i} className={`lpc-pr-bubble ${l.me ? "lpc-pr-me" : "lpc-pr-you"}`} style={at(300 + i * 600)}>
							{l.poster && <img src={tmdbImageUrl(l.poster, "w92")} alt="" />}
							<span>{l.text}</span>
						</div>
					))}
				</div>
			</div>
			<div className="lpc-pr-chatveil" />
			<div className="lpc-pr-center">
				<h2 className="lpc-pr-big">
					<Words words={["Every", "night,"]} from={4500} step={200} />
					<br />
					<Words words={["the", "same", "question."]} from={4900} step={200} amber={[2]} />
				</h2>
			</div>
		</Root>
	)
}

/** Every app its own wall: real service logos over columns of posters, then the line. */
export function OpenerApps({ data }: ClipProps) {
	const seen = new Set<string>()
	const logos = [...data.landing.flatMap((c) => c.services ?? []), ...data.services]
		.filter((s) => s.logo_path)
		.filter((s) => {
			const brand = s.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6)
			if (seen.has(brand) || /channel/i.test(s.name)) return false
			seen.add(brand)
			return true
		})
		.slice(0, 5)
	const all = posters(data)
	const n = logos.length
	const word = ["", "One", "Two", "Three", "Four", "Five"][n] ?? `${n}`
	return (
		<Root label="Every app, its own list">
			<div className="lpc-pr-apps" aria-hidden="true">
				{logos.map((s, i) => {
					const col = rotate(all, i * 3)
					return (
						<div key={s.id} className="lpc-pr-app" style={at(200 + i * 160)}>
							<div className={`lpc-pr-col ${i % 2 ? "lpc-pr-rev" : ""}`}>
								{[...col, ...col].map((p, j) => (
									<img key={`${p}-${j}`} src={tmdbImageUrl(p, "w154")} alt="" />
								))}
							</div>
							<img className="lpc-pr-applogo" src={tmdbImageUrl(s.logo_path as string, "w92")} alt={s.name} />
						</div>
					)
				})}
			</div>
			<div className="lpc-pr-appveil" />
			<div className="lpc-pr-bottom">
				<h2 className="lpc-pr-big">
					<Words words={[`${word}`, "apps."]} from={2900} step={220} />{" "}
					<Words words={[`${word}`, "lists."]} from={3400} step={220} />
				</h2>
				<p className="lpc-pr-sub lpc-pr-in lpc-pr-wide" style={delay(4100)}>
					And not one of them knows what you're in the mood for.
				</p>
			</div>
		</Root>
	)
}

/** The remote: click, click, click through a row of tiles while the clock runs to 11:47 pm. */
export function OpenerRemote({ data }: ClipProps) {
	const pics = unique(data.landing.flatMap((c) => c.backdrop_path ?? []))
	const row = [...pics, ...pics].slice(0, 14)
	return (
		<Root label="Clicking through tiles" className="lpc-pr-remote">
			<div className="lpc-pr-topclock" aria-label="Late evening">
				<Clock times={["8:30 pm", "9:12 pm", "10:05 pm", "10:56 pm", "11:47 pm"]} from={700} d={5200} />
			</div>
			<div className="lpc-pr-tophead lpc-pr-kicker lpc-pr-in" style={delay(300)}>
				Trending now
			</div>
			<div className="lpc-pr-tv" aria-hidden="true">
				<div className="lpc-pr-tiles">
					{row.map((p, i) => (
						<img key={`${p}-${i}`} src={tmdbImageUrl(p, "w300")} alt="" />
					))}
				</div>
				<div className="lpc-pr-focus" />
			</div>
			<div className="lpc-pr-bottom">
				<h2 className="lpc-pr-big">
					<Words words={["Click.", "Click.", "Click."]} from={3900} step={300} amber={[2]} />
				</h2>
				<p className="lpc-pr-sub lpc-pr-in" style={delay(5000)}>
					Still nothing to watch.
				</p>
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Sign-offs

/** The wordmark lands in a warm light; one line under it. */
export function CloserWordmark(_p: ClipProps) {
	return (
		<Root label="GoodWatch. Find something good.">
			<div className="lpc-pr-glow" />
			<div className="lpc-pr-center">
				<div className="lpc-pr-mark" style={at(300)}>
					<GoodWatchWordmark fontSize="11cqw" />
				</div>
				<p className="lpc-pr-sub lpc-pr-in" style={{ ...delay(1400), fontSize: "max(16px, 3.6cqw)" }}>
					Find something good.
				</p>
			</div>
		</Root>
	)
}

/** The sign-up wall: posters deal in grey, a light glides over them and settles on one, which turns to color. */
export function CloserWall({ data }: ClipProps) {
	const all = posters(data)
	const best = [...data.landing]
		.filter((c) => c.poster_path)
		.sort((a, b) => (b.goodwatch_overall_score_normalized_percent ?? 0) - (a.goodwatch_overall_score_normalized_percent ?? 0))[0]
	const CHOSEN = 14 // row 1, column 5 of 9
	const cells = Array.from({ length: 27 }, (_, i) => (i === CHOSEN && best?.poster_path ? best.poster_path : all[(i * 7) % all.length]))
	const LIT = 3300
	return (
		<Root label="Somewhere in here is your next favorite">
			<div className="lpc-pr-grid" aria-hidden="true">
				{cells.map((p, i) => {
					const row = Math.floor(i / 9)
					const col = i % 9
					const chosen = i === CHOSEN
					return (
						<div
							key={i}
							className={`lpc-pr-cell ${chosen ? "lpc-pr-chosen" : ""}`}
							style={{ ...at(100 + (row + col) * 70), "--lit": `${LIT}ms` } as CSSProperties}
						>
							{p && <img className="lpc-pr-grey" src={tmdbImageUrl(p, "w154")} alt="" />}
							{chosen && p && (
								<>
									<img className="lpc-pr-color" src={tmdbImageUrl(p, "w342")} alt="" />
									<i className="lpc-pr-ring" />
								</>
							)}
						</div>
					)
				})}
			</div>
			<div
				className="lpc-pr-light"
				style={{ "--lx": "61.9cqw", "--ly": "calc(-6cqh + 25.5cqw)" } as CSSProperties}
				aria-hidden="true"
			/>
			<div className="lpc-pr-wallveil" />
			<div className="lpc-pr-bottom">
				<h2 className="lpc-pr-big" style={{ fontSize: "max(22px, 6.4cqw)" }}>
					<Words words={["Somewhere", "in", "here", "is", "your"]} from={3700} step={110} />{" "}
					<Words words={["next", "favorite."]} from={4300} step={160} amber={[0, 1]} />
				</h2>
			</div>
		</Root>
	)
}

/** "Your turn.": three empty slots deal in, a tap pulses on the first. Leads into the tap-three screen. */
export function CloserTurn(_p: ClipProps) {
	return (
		<Root label="Your turn">
			<div className="lpc-pr-center" style={{ gap: "4cqh" }}>
				<h2 className="lpc-pr-big" style={{ fontSize: "max(30px, 13cqw)" }}>
					<Words words={["Your", "turn."]} from={300} step={240} amber={[1]} />
				</h2>
				<div className="lpc-pr-slots" aria-hidden="true">
					{[1, 2, 3].map((n) => (
						<div key={n} className="lpc-pr-slot" style={at(1100 + (n - 1) * 170)}>
							{n}
						</div>
					))}
				</div>
				<p className="lpc-pr-sub lpc-pr-in" style={delay(1900)}>
					Tap three you loved. We'll take it from there.
				</p>
			</div>
		</Root>
	)
}

/** The wordmark small, "Free." big, then what it costs to start: nothing. */
export function CloserFree(_p: ClipProps) {
	return (
		<Root label="Free. No account needed to start.">
			<div className="lpc-pr-glow" />
			<div className="lpc-pr-center" style={{ gap: "3.4cqh" }}>
				<div className="lpc-pr-mark" style={at(200)}>
					<GoodWatchWordmark fontSize="5cqw" />
				</div>
				<h2 className="lpc-pr-big lpc-pr-amber" style={{ fontSize: "max(34px, 15cqw)" }}>
					<Words words={["Free."]} from={900} />
				</h2>
				<p className="lpc-pr-sub lpc-pr-in" style={delay(1500)}>
					No account needed to start.
				</p>
				<span className="lpc-pr-cta lpc-pr-in" style={delay(2200)}>
					Find something good
				</span>
			</div>
		</Root>
	)
}
