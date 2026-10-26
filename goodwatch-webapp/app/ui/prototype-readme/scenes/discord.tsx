// PROTOTYPE (README clip "discord"): a quick /together round in the intro's Discord look (scenes/discord/), as the
// bot really runs it (app/server/discord/together/cards.ts): in #movie-night sam runs /together; GoodWatch posts
// "Let's watch together"; each friend gets a private voting card (shown on the right, "only you can see this") and
// says Yep or Nope title by title; the public message counts the participants, shows Arcane as a match once all
// three said Yep, counts the picks, and turns into "Decided: Arcane". Then it rests; the recorder fades the tail
// into the first frame. The thread sticks to the bottom like Discord's and climbs as messages grow (measured).
import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useRef } from "react"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import "~/ui/living-room/intro/scenes/discord/discord.css"
import {
	AppAvatar,
	AppName,
	Btn,
	type DcTitle,
	Facts,
	PEOPLE,
	ServiceBtn,
	Used,
	UserAvatar,
	backdrop,
	pickTitles,
	poster,
} from "~/ui/living-room/intro/scenes/discord/kit"
import "./discord.css"

const a = (name: string, d: number, du: number, ez?: string, extra?: Record<string, string | number>) =>
	({
		"--an": name,
		"--d": `${d}ms`,
		"--du": `${du}ms`,
		...(ez ? { "--ez": ez } : {}),
		...extra,
	}) as CSSProperties
const A = (name: string, d: number, du: number, ez?: string, extra?: Record<string, string | number>) => ({
	className: "rm-dc-a",
	style: a(name, d, du, ez, extra),
})

// ---- Timing (ms at k = 1)
const T = {
	mia: 300,
	leo: 1000,
	type: 1650,
	menu: 1750,
	send: 2600,
	app: 2850,
	ballots: 3500,
	/** Title 1 (Severance): sam Yep, Mia Yep, Leo Nope. */
	vote1: [4400, 4700, 5000],
	/** Title 2 (Arcane): everyone Yep. */
	vote2: [5900, 6200, 6500],
	match: 6800,
	picks: [7500, 7800, 8100],
	decided: 8700,
}
/** The decision lands at T.decided; the finished channel rests ~3.4 s, the recorder fades the last 600 ms. */
export const DISCORD_MS = T.decided + 4000
const VOTES1 = ["yep", "yep", "nope"] as const
const TYPED = "/together"
const NEXT = 320

function Msg({ who, text, at, reveal }: { who: (typeof PEOPLE)[number]; text: string; at: number; reveal: string }) {
	return (
		<div {...A("intro-dc-pop", at, 450)} data-reveal={reveal}>
			<div className="rm-dc-msg">
				<UserAvatar name={who.name} color={who.color} />
				<div>
					<span className="intro-dc-msg-name">
						{who.name} <small>Today at 21:03</small>
					</span>
					<p>{text}</p>
				</div>
			</div>
		</div>
	)
}

/** A text that changes: each version fades in over the one before, at its time. */
function Swap({ items }: { items: { at: number; node: ReactNode }[] }) {
	return (
		<span className="rm-dc-swap">
			{items.map((x, i) => {
				// Each version leaves as the next one comes.
				const next = items[i + 1]
				const body = next ? <span {...A("intro-dc-out", next.at, 160, "linear")}>{x.node}</span> : x.node
				return (
					<span key={x.at} {...(i === 0 ? {} : A("rm-dc-swapin", x.at, 360))}>
						{body}
					</span>
				)
			})}
		</span>
	)
}

function Select({ children }: { children: ReactNode }) {
	return (
		<div className="rm-dc-select">
			<span>{children}</span>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
			</svg>
		</div>
	)
}

const participants = (n: number, still: number) => `${n} participant${n === 1 ? "" : "s"} · ${still} still voting`

/** The public /together message while it is open: before any match (rows = false) and with Arcane as a match. */
function OpenCard({ match, rows }: { match: DcTitle; rows: boolean }) {
	return (
		<div className="intro-dc-card rm-dc-card">
			<h3 className="intro-dc-h1">Let's watch together</h3>
			<p>Started by sam · Movies and shows</p>
			<p>
				{rows ? (
					participants(3, 3)
				) : (
					<Swap
						items={[
							{ at: 0, node: participants(0, 0) },
							...T.vote1.map((t, i) => ({ at: t, node: participants(i + 1, i + 1) })),
						]}
					/>
				)}
			</p>
			{rows ? (
				<>
					<p className="intro-dc-small">Where to watch in United States</p>
					<div className="rm-dc-row">
						<img className="intro-dc-poster rm-dc-rowposter" src={poster(match.poster)} alt="" />
						<div className="rm-dc-rowtx">
							<b className="rm-dc-rowname">{match.name}</b>
							<Facts t={match} />
							<b className="rm-dc-label">
								<Swap
									items={[0, 1, 2, 3].map((n) => ({
										at: n === 0 ? 0 : T.picks[n - 1],
										node: `Match · picked by ${n} of 3`,
									}))}
								/>
							</b>
						</div>
					</div>
					<Select>Pick a match</Select>
				</>
			) : (
				<p className="intro-dc-small">Join and vote privately. Matches appear here as you vote.</p>
			)}
			<div className="intro-dc-row">
				{rows ? (
					<Btn kind="primary">Join</Btn>
				) : (
					// Each friend presses Join and gets their private voting card.
					[0, 1, 2].reduceRight<ReactNode>(
						(inner, i) => (
							<span key={i} {...A("intro-dc-press", T.ballots - 250 + i * 160, 260)}>
								{inner}
							</span>
						),
						<Btn kind="primary">Join</Btn>,
					)
				)}
				<Btn>End</Btn>
			</div>
		</div>
	)
}

function DecidedCard({ t }: { t: DcTitle }) {
	return (
		<div className="intro-dc-card rm-dc-card">
			<h3 className="intro-dc-h1">Decided: {t.name}</h3>
			<p>
				Everyone picked it. <b className="rm-dc-strong">3 of 3 participants</b>.
			</p>
			{t.backdrop && <img className="intro-dc-poster rm-dc-decided-img" src={backdrop(t.backdrop)} alt="" />}
			<Facts t={t} />
			<div className="intro-dc-row">
				<ServiceBtn t={t} />
				<Btn link>Open on GoodWatch</Btn>
			</div>
		</div>
	)
}

/** One friend's private voting card: title 1, their vote, then title 2 and Yep. */
function Ballot({ i, titles, at }: { i: number; titles: DcTitle[]; at: number }) {
	const who = PEOPLE[i]
	const v1 = T.vote1[i]
	const v2 = T.vote2[i]
	const face = (t: DcTitle, n: number, vote: "yep" | "nope", pressAt: number) => (
		<div className="rm-dc-face">
			<p className="intro-dc-small">Together · title {n} of 30</p>
			<div className="rm-dc-bal-row">
				<img className="intro-dc-poster rm-dc-bal-poster" src={poster(t.poster)} alt="" />
				<div className="rm-dc-bal-tx">
					<b className="rm-dc-bal-name">{t.name}</b>
					<Facts t={t} short />
					<div className="intro-dc-row">
						<span {...A("intro-dc-press", pressAt, 300)}>
							<span className={`intro-dc-btn rm-dc-yep ${vote === "yep" ? "rm-dc-chosen" : ""}`}>
								{vote === "yep" && <i {...A("rm-dc-lit", pressAt, 260)} />}
								Yep
							</span>
						</span>
						<span {...A("intro-dc-press", vote === "nope" ? pressAt : 1e9, 300)}>
							<span className={`intro-dc-btn rm-dc-nope ${vote === "nope" ? "rm-dc-chosen" : ""}`}>
								{vote === "nope" && <i {...A("rm-dc-lit", pressAt, 260)} />}
								Nope
							</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	)
	return (
		<div {...A("rm-dc-rise", at, 650)}>
			<div className="rm-dc-ballot">
				<p className="rm-dc-only">
					<span className="intro-dc-mini" style={{ background: who.color }}>
						{who.name[0].toUpperCase()}
					</span>
					<b>{who.name}</b> · only you can see this
				</p>
				<div className="intro-dc-card rm-dc-bal-card">
					<div {...A("rm-dc-leave", v1 + NEXT, 300, "ease-in")}>{face(titles[0], 1, VOTES1[i], v1)}</div>
					<div {...A("rm-dc-swapin", v1 + NEXT + 120, 420)}>
						{face(titles[1], 2, "yep", v2)}
					</div>
				</div>
			</div>
		</div>
	)
}

/** Discord keeps the newest message at the bottom: the thread sits so each reveal's bottom meets the view's. */
function useStick(view: RefObject<HTMLDivElement | null>, thread: RefObject<HTMLDivElement | null>) {
	useLayoutEffect(() => {
		const v = view.current
		const t = thread.current
		if (!v || !t) return
		const offsetIn = (el: HTMLElement) => {
			let y = 0
			let n: HTMLElement | null = el
			while (n && n !== t) {
				y += n.offsetTop
				n = n.offsetParent as HTMLElement | null
			}
			return y + el.offsetHeight
		}
		const measure = () => {
			const target = v.clientHeight - v.clientHeight * 0.03
			const wraps = [...v.querySelectorAll<HTMLElement>("[data-stick]")]
			let last: number | null = null
			for (const w of wraps) {
				const el = t.querySelector<HTMLElement>(`[data-reveal="${w.dataset.stick}"]`)
				if (!el) continue
				const y = target - offsetIn(el)
				if (last === null) w.style.setProperty("--y0", `${y}px`)
				else w.style.setProperty("--dy", `${y - last}px`)
				last = y
			}
		}
		measure()
		document.fonts?.ready.then(measure)
		const ro = new ResizeObserver(measure)
		ro.observe(t)
		return () => ro.disconnect()
	}, [view, thread])
}

function Input() {
	return (
		<div className="intro-dc-input">
			<span className="intro-dc-plus" aria-hidden="true">
				+
			</span>
			<span className="intro-dc-typed">
				<span {...A("intro-dc-out", T.type, 80)} className="intro-dc-placeholder rm-dc-a">
					Message #movie-night
				</span>
				<span {...A("intro-dc-fade", T.send + 120, 200)} className="intro-dc-placeholder rm-dc-a">
					Message #movie-night
				</span>
				<span {...A("intro-dc-out", T.send, 120)} style={{ ...a("intro-dc-out", T.send, 120), display: "flex", alignItems: "center" }}>
					{[...TYPED].map((ch, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
						<span key={i} {...A("intro-dc-fade", T.type + (i === 0 ? 0 : 150 + i * 75), 60)}>
							{ch}
						</span>
					))}
					<span {...A("intro-dc-fade", T.type, 60)}>
						<span className="intro-dc-caret" />
					</span>
				</span>
			</span>
		</div>
	)
}

function Menu() {
	return (
		<div className="intro-dc-menu-at rm-dc-a" style={a("intro-dc-out-down", T.send, 220)}>
			<div className="intro-dc-menu rm-dc-menu rm-dc-a" style={{ ...a("intro-dc-pop", T.menu, 350), position: "relative", left: 0, right: 0, bottom: 0 }}>
				<div className="intro-dc-menu-head">
					<AppAvatar />
					GoodWatch
				</div>
				<ul>
					<li className="on">
						<b {...A("intro-dc-press", T.send - 200, 220)}>/together</b>
						<span>Choose what to watch together with private votes</span>
					</li>
				</ul>
			</div>
		</div>
	)
}

export function ReadmeDiscord({ data }: SceneProps) {
	const view = useRef<HTMLDivElement>(null)
	const thread = useRef<HTMLDivElement>(null)
	useStick(view, thread)
	const titles = pickTitles(data, ["Severance", "Arcane"], 2)
	const arcane = titles[1]
	const reveals = [
		{ id: "mia", t: T.mia },
		{ id: "leo", t: T.leo },
		{ id: "open", t: T.app },
		{ id: "match", t: T.match },
		{ id: "decided", t: T.decided },
	]
	const rows = (
		<div ref={thread} className="rm-dc-thread">
			<div className="rm-dc-welcome" data-reveal="start">
				<span className="rm-dc-welcome-hash">#</span>
				<h3>Welcome to #movie-night!</h3>
				<p>This is the start of the #movie-night channel.</p>
			</div>
			<Msg who={PEOPLE[1]} text="movie night? what are we watching 🍿" at={T.mia} reveal="mia" />
			<Msg who={PEOPLE[2]} text="no idea. let's vote" at={T.leo} reveal="leo" />
			<div {...A("intro-dc-pop", T.app, 550)} className="rm-dc-app rm-dc-a">
				<div className="rm-dc-used">
					<Used user={PEOPLE[0].name} command="/together" color={PEOPLE[0].color} />
				</div>
				<div className="rm-dc-appbody">
					<AppAvatar />
					<div className="rm-dc-appcol">
						<AppName />
						<div className="rm-dc-cards">
							<div data-reveal="open" {...A("intro-dc-out", T.match, 180, "linear")}>
								<OpenCard match={arcane} rows={false} />
							</div>
							<div data-reveal="match" {...A("rm-dc-swapin", T.match, 360)}>
								<div {...A("intro-dc-out", T.decided, 180, "linear")}>
									<OpenCard match={arcane} rows />
								</div>
							</div>
							<div data-reveal="decided" {...A("rm-dc-swapin", T.decided, 450)}>
								<DecidedCard t={arcane} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
	const stuck = reveals.reduceRight<ReactNode>(
		(inner, r) => (
			<div key={r.id} data-stick={r.id} {...A("rm-dc-climb", r.t - 40, 600, "cubic-bezier(.45,0,.25,1)")}>
				{inner}
			</div>
		),
		rows,
	)
	return (
		<div
			className="intro-dc rm-dc"
			role="img"
			aria-label="GoodWatch's Discord bot: in #movie-night sam runs /together, everyone votes Yep or Nope privately, Arcane becomes a match and GoodWatch posts Decided: Arcane."
		>
			<div className="intro-dc-win rm-dc-win">
				<div className="intro-dc-rail" aria-hidden="true">
					<span className="on">MN</span>
					<span>🎮</span>
					<span>LF</span>
					<i />
					<span>+</span>
				</div>
				<div className="intro-dc-main">
					<div className="intro-dc-top">
						<span className="hash">#</span> movie-night
					</div>
					<div ref={view} className="intro-dc-view">
						<div data-stick="start" className="rm-dc-base">
							{stuck}
						</div>
					</div>
					<Menu />
					<Input />
				</div>
			</div>
			<div className="rm-dc-ballots">
				{[0, 1, 2].map((i) => (
					<Ballot key={i} i={i} titles={titles} at={T.ballots + i * 160} />
				))}
			</div>
		</div>
	)
}
