// The Discord window of the chapter. #movie-night: two friends ask what to watch, someone types /watch, Discord's
// command menu pops with GoodWatch's commands, and the app answers with its /watch card, which then leaves the window
// as its copy lifts out (ending.tsx) and two friends reply. The window fills its parent box; the caller passes the
// box's height, the font-size and the story's start time, so the thread's scroll can be computed.
import type { CSSProperties } from "react"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import "./discord.css"
import {
	AppAvatar,
	AppName,
	Btn,
	EASE_IN_OUT,
	Facts,
	PEOPLE,
	ServiceBtn,
	Used,
	UserAvatar,
	anim,
	backdrop,
	pickTitles,
	poster,
} from "./kit"

const MENU = [
	{ name: "watch", description: "Get a pick to watch" },
	{
		name: "together",
		description: "Choose what to watch together with private votes",
	},
]

/** The story's beats, ms after the window's start (t0). */
export const BEAT = {
	mia: 150,
	leo: 550,
	type: 950,
	menu: 1050,
	pick: 1780,
	send: 1950,
	land: 2150,
	service: 3950,
}
/** "/watch" typed into the input, one character at a time (ms after t0). */
const TYPED = [
	{ ch: "/", at: 1000 },
	{ ch: "w", at: 1250 },
	{ ch: "a", at: 1350 },
	{ ch: "t", at: 1450 },
	{ ch: "c", at: 1550 },
	{ ch: "h", at: 1650 },
]

export type ChannelOpts = {
	/** Font-size of the window in cqw. */
	font: number
	/** The window box's height in cqw. */
	h: number
	/** When the story starts (ms at k = 1). */
	t0?: number
	/** Width of the app's message column in em (the card's outer width). */
	cardW?: number
	/** The thread's card leaves the window at this time (ms at k = 1), as its copy lifts out of the same spot. */
	leaveAt: number
	/** How long the thread's card takes to fade as it leaves (ms). */
	leaveDu: number
	/** The friends' replies, shown under GoodWatch's name once its card has left the window. */
	after: { who: number; text: string; at: number }[]
}

/** Card geometry in em: the backdrop's size and the card's top, from the thread's top. */
function cardBox(cardW: number) {
	const bw = cardW - 2.05
	const bh = (bw * 12.4) / 22
	return { bw, bh, top: 10.6 }
}

/** The thread's translateY (em) at its start and after each climb; the last stops with the card's top half in view. */
export function climbs({
	font,
	h,
	cardW = 24.05,
}: Pick<ChannelOpts, "font" | "h" | "cardW">) {
	const view = h / font - 5.8
	const start = view - 0.5 - 7.0
	const box = cardBox(cardW)
	const list = [
		{ at: BEAT.type, du: 450, to: start - 5.8 },
		{
			at: BEAT.land,
			du: 650,
			to: Math.min(start - 5.8, view - (box.top + 2.5 + box.bh * 0.55)),
		},
	]
	return { view, start, list }
}

function Msg({
	who,
	text,
	top,
	at,
	time = "21:03",
}: {
	who: (typeof PEOPLE)[number]
	text: string
	top: number
	at: number
	time?: string
}) {
	const a = anim("pop", at, 450)
	return (
		<div
			className={`intro-dc-msg ${a.className}`}
			style={{ ...a.style, top: `${top}em`, height: "3em" }}
		>
			<UserAvatar name={who.name} color={who.color} />
			<div>
				<span className="intro-dc-msg-name">
					{who.name} <small>Today at {time}</small>
				</span>
				<p>{text}</p>
			</div>
		</div>
	)
}

/** The /watch card, in the thread and as the copy that lifts out of it. */
export function WatchCard({
	data,
	cardW = 24.05,
	t0 = 0,
	serviceAt,
	compact = false,
}: SceneProps & {
	cardW?: number
	t0?: number
	serviceAt?: number
	compact?: boolean
}) {
	const [t] = pickTitles(data, ["Arcane", "Shōgun", "Severance"], 1)
	const { bw, bh } = cardBox(cardW)
	if (compact) {
		// On the phone picture: the same card with fewer details, so its words can be bigger.
		return (
			<div
				className="intro-dc-card intro-dc-card-compact"
				style={{ "--accent": "transparent" } as CSSProperties}
			>
				{t.backdrop ? (
					<img
						className="intro-dc-poster"
						src={backdrop(t.backdrop)}
						alt=""
						style={{ width: `${bw}em`, height: `${bh}em` }}
					/>
				) : (
					<div
						className="intro-dc-poster"
						style={{ width: `${bw}em`, height: `${bh}em` }}
					/>
				)}
				<h3 className="intro-dc-h1" style={{ fontSize: "1.9em" }}>
					{t.name}
				</h3>
				<Facts t={t} short />
				<div className="intro-dc-row">
					<ServiceBtn
						t={t}
						{...anim("press", t0 + (serviceAt ?? BEAT.service), 300)}
					/>
				</div>
			</div>
		)
	}
	return (
		<div
			className="intro-dc-card"
			style={{ "--accent": "transparent" } as CSSProperties}
		>
			<p className="intro-dc-small" style={{ height: "1.22em" }}>
				Your next pick
			</p>
			{t.backdrop ? (
				<img
					className="intro-dc-poster"
					src={backdrop(t.backdrop)}
					alt=""
					style={{ width: `${bw}em`, height: `${bh}em` }}
				/>
			) : (
				<div
					className="intro-dc-poster"
					style={{ width: `${bw}em`, height: `${bh}em` }}
				/>
			)}
			<div style={{ display: "flex", gap: "0.7em", height: "5.6em" }}>
				<div
					style={{
						flex: 1,
						minWidth: 0,
						display: "flex",
						flexDirection: "column",
						gap: "0.35em",
					}}
				>
					<h3 className="intro-dc-h1" style={{ fontSize: "1.9em" }}>
						{t.name}
					</h3>
					<Facts t={t} />
				</div>
				<img
					className="intro-dc-poster"
					src={poster(t.poster)}
					alt=""
					style={{ width: "3.73em", height: "5.6em" }}
				/>
			</div>
			<div className="intro-dc-sep" style={{ height: "0.05em" }} />
			<p className="intro-dc-small" style={{ height: "1.22em" }}>
				Where to watch in United States
			</p>
			<div className="intro-dc-row">
				<ServiceBtn
					t={t}
					{...anim("press", t0 + (serviceAt ?? BEAT.service), 300)}
				/>
			</div>
			<div className="intro-dc-row">
				<Btn kind="primary">Another</Btn>
				<Btn link>Open on GoodWatch</Btn>
			</div>
		</div>
	)
}

function Thread({ data, opts }: SceneProps & { opts: ChannelOpts }) {
	const t0 = opts.t0 ?? 0
	const cardW = opts.cardW ?? 24.05
	const { start, list } = climbs(opts)
	const app = anim("pop", t0 + BEAT.land, 550)
	const rows = (
		<div className="intro-dc-thread">
			<Msg
				who={PEOPLE[1]}
				text="what are we watching tonight? 🍿"
				top={0.6}
				at={t0 + BEAT.mia}
			/>
			<Msg
				who={PEOPLE[2]}
				text="something none of us has seen pls"
				top={4.0}
				at={t0 + BEAT.leo}
			/>
			<div
				className={app.className}
				style={{
					...app.style,
					position: "absolute",
					top: "7.6em",
					left: "0.9em",
				}}
			>
				<div style={{ height: "1.4em", paddingLeft: "3.05em" }}>
					<Used
						user={PEOPLE[0].name}
						command="/watch"
						color={PEOPLE[0].color}
					/>
				</div>
				<div style={{ display: "flex", gap: "0.85em" }}>
					<AppAvatar />
					<div style={{ width: `${cardW}em` }}>
						<div style={{ height: "1.6em" }}>
							<AppName />
						</div>
						<div
							{...anim("out", opts.leaveAt, opts.leaveDu, { "--ez": "linear" })}
						>
							<WatchCard data={data} cardW={cardW} t0={t0} />
						</div>
					</div>
				</div>
			</div>
			{opts.after.map((m, i) => (
				<Msg
					key={m.text}
					who={PEOPLE[m.who]}
					text={m.text}
					top={11.7 + i * 3.2}
					at={m.at}
					time="21:05"
				/>
			))}
		</div>
	)
	const climbed = list.reduce((inner, c, i) => {
		const prev = i ? list[i - 1].to : start
		const a = anim("climb", t0 + c.at, c.du, {
			"--to": `${c.to - prev}em`,
			"--ez": EASE_IN_OUT,
		})
		return (
			<div key={c.at} className={a.className} style={a.style}>
				{inner}
			</div>
		)
	}, rows)
	return (
		<div className="intro-dc-view">
			<div style={{ transform: `translateY(${start}em)` }}>{climbed}</div>
		</div>
	)
}

function Input({ t0 }: { t0: number }) {
	const ph = anim("out", t0 + BEAT.type, 100)
	const back = anim("fade", t0 + BEAT.send + 100, 200)
	const typedOut = anim("out", t0 + BEAT.send, 120)
	return (
		<div className="intro-dc-input">
			<span className="intro-dc-plus" aria-hidden="true">
				+
			</span>
			<span className="intro-dc-typed">
				<span
					className={`intro-dc-placeholder ${ph.className}`}
					style={ph.style}
				>
					Message #movie-night
				</span>
				<span
					className={`intro-dc-placeholder ${back.className}`}
					style={back.style}
				>
					Message #movie-night
				</span>
				<span
					className={typedOut.className}
					style={{ ...typedOut.style, display: "flex", alignItems: "center" }}
				>
					{TYPED.map((c) => (
						<span key={c.at} {...anim("fade", t0 + c.at, 60)}>
							{c.ch}
						</span>
					))}
					<span {...anim("fade", t0 + BEAT.type, 60)}>
						<span className="intro-dc-caret" />
					</span>
				</span>
			</span>
		</div>
	)
}

function Menu({ t0 }: { t0: number }) {
	const pop = anim("pop", t0 + BEAT.menu, 350)
	const out = anim("out-down", t0 + BEAT.send, 220)
	return (
		<div className={`intro-dc-menu-at ${out.className}`} style={out.style}>
			<div
				className={`intro-dc-menu ${pop.className}`}
				style={{
					...pop.style,
					position: "relative",
					left: 0,
					right: 0,
					bottom: 0,
				}}
			>
				<div className="intro-dc-menu-head">
					<AppAvatar />
					GoodWatch
				</div>
				<ul>
					{MENU.map((c, i) => (
						<li key={c.name} className={i === 0 ? "on" : ""}>
							<b {...(i === 0 ? anim("press", t0 + BEAT.pick, 220) : {})}>
								/{c.name}
							</b>
							<span>{c.description}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

/** The Discord window. Fills its parent; put it inside an `.intro-dc` root. */
export function Channel({ data, ...opts }: SceneProps & ChannelOpts) {
	const t0 = opts.t0 ?? 0
	return (
		<div
			className="intro-dc-chan intro-dc-win"
			style={{ fontSize: `${opts.font}cqw` }}
		>
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
				<Thread data={data} opts={opts} />
				<Menu t0={t0} />
				<Input t0={t0} />
			</div>
		</div>
	)
}
