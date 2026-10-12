// PROTOTYPE - throwaway. Direction "Glow": light does the work. A warm, dark picture that belongs to the room;
// round, soft shapes; stills in landscape with their titles on them. The focus is a lamp: the focused item lights
// up, lifts a little and throws amber light, a pool of that light glides behind it (the Follower in scene.tsx),
// and everything else is dimmed. Type is the brand font at a medium weight. Screens rise in gently.
import type { ReactNode } from "react"
import { type Dest, ISLANDS, SIDES } from "~/ui/prototype-tv-flow/data"
import { useTv } from "~/ui/prototype-tv-flow/engine"
import { F, metaOf } from "~/ui/prototype-tv-flow/kit"
import { backdropOf } from "./art"
import { Actions, Ambient, AppArt, BarTitle, Corner, Img, type Skin, titleSize, useExpandAt } from "./base"

const CSS = `
.tvd-glow { color: #fff4e6; background: radial-gradient(120% 95% at 50% 0%, #2b1a10 0%, #130c09 55%, #0a0706 100%); }
.tvd-glow .tvf { border-radius: 28px; transition: transform .24s cubic-bezier(.2,.8,.2,1), box-shadow .24s, filter .24s, background-color .24s, color .24s; }
.tvd-glow .g-tile { overflow: hidden; filter: brightness(.5) saturate(.7); box-shadow: 0 10px 30px rgba(0,0,0,.5); }
.tvd-glow .g-tile.tvf-on { filter: none; transform: translateY(-8px) scale(1.04); box-shadow: 0 0 0 3px rgba(253,186,116,.95), 0 0 46px 6px rgba(251,146,60,.55), 0 20px 40px rgba(0,0,0,.6); z-index: 2; }
.tvd-glow .g-btn { background: rgba(255,237,213,.09); border-radius: 999px; font-weight: 600; box-shadow: inset 0 0 0 1.5px rgba(255,237,213,.2); }
.tvd-glow .g-btn.tvf-on { background: #fde6c8; color: #2a1608; transform: translateY(-4px); box-shadow: 0 0 64px 10px rgba(251,146,60,.55); }
.tvd-glow .g-act { color: #fff4e6; border-radius: 999px; font-weight: 600; background: rgba(255,237,213,.07); box-shadow: inset 0 0 0 1.5px rgba(255,237,213,.2); }
.tvd-glow .g-act.tvf-on { background: #fde6c8; color: #2a1608; transform: translateY(-3px); box-shadow: 0 0 54px 8px rgba(251,146,60,.55); }
.tvd-glow .g-x { color: #fbbf24; border-radius: 999px; font-weight: 600; box-shadow: inset 0 0 0 2.5px #fbbf24; }
.tvd-glow .g-x.tvf-on { background: #fbbf24; color: #2a1608; box-shadow: 0 0 70px 12px rgba(251,191,36,.6); }
.tvd-glow .g-spot { background: radial-gradient(closest-side, rgba(251,146,60,.28), rgba(251,146,60,0)); }
.tvd-glow .tvd-screen { animation: g-in .36s cubic-bezier(.2,.8,.2,1) both; }
@keyframes g-in { from { opacity: 0; transform: translateY(18px); } }
.tvd-glow .tvd-menu { background: rgba(10,7,6,.7); animation: tvd-fade .25s both; }
.tvd-glow .tvd-toast { background: #fde6c8; color: #2a1608; border-radius: 999px; padding: 12px 30px; font-size: 26px; font-weight: 600; box-shadow: 0 0 50px 6px rgba(251,146,60,.45); }
`

const SOFT = "text-[#fff4e6]/65"

const X = { phone: "g-x h-[54px] gap-2.5 px-3.5 text-[20px]", desk: "g-x h-[64px] gap-4 px-6 text-[26px]" }
const MOTIF = { w: 44, h: 32, stroke: 4 }

/** The actions as this direction draws them: soft outlined pills, and the expand key outlined in amber. */
function Bar({ dest, className }: { dest?: Dest; className?: string }) {
	const P = useTv().phone
	return <Actions dest={dest} className={className} cls={P ? "g-act h-[54px] w-[54px]" : "g-act h-[64px] gap-2.5 px-5 text-[24px]"} xcls={P ? X.phone : X.desk} motif={MOTIF} />
}

function Frame({ name, crumb, dest, art, children }: { name: string; crumb?: string; dest: Dest; art?: string; children: ReactNode }) {
	const P = useTv().phone
	return (
		<>
			{art && <Ambient src={art} className="opacity-[0.16]" />}
			<div className={`absolute inset-x-0 top-0 flex gap-4 ${P ? "h-[78px] items-center justify-between px-5" : "h-[108px] items-center justify-between px-14"}`}>
				<BarTitle name={name} crumb={crumb} nameClass={`font-semibold ${P ? "text-[24px]" : "text-[38px]"}`} crumbClass={`${SOFT} ${P ? "text-[20px]" : "text-[24px]"}`} />
				<Bar dest={dest} />
			</div>
			<div className={`absolute inset-x-0 bottom-0 ${P ? "top-[78px] overflow-hidden px-5 pb-5 pt-1" : "top-[108px] px-14 pb-10"}`}>{children}</div>
			{/* The expand key in the picture's bottom right corner: on the phone always, on the desktop as the third place. */}
			<Corner dest={dest} className={P ? X.phone : X.desk} motif={MOTIF} at={P ? "bottom-5 right-5" : "bottom-10 right-14"} />
		</>
	)
}

/** The phone's last row: what a screen puts beside the expand key, which has the right end of it. */
function Foot({ children }: { children?: ReactNode }) {
	return <div className="mt-2.5 flex h-[54px] shrink-0 items-center gap-2 pr-[158px]">{children}</div>
}

/** A still with its title on it, the way this direction shows a title in a list. `small` is the phone's. */
function Still({ title, sub, small, className = "", style }: { title: { key: string; title: string }; sub?: string; small?: boolean; className?: string; style?: object }) {
	return (
		<span className={`relative block overflow-hidden ${className}`} style={style}>
			<Img src={backdropOf(title.key)} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0 bg-gradient-to-t from-[#120a06]/95 via-[#120a06]/25 to-transparent" />
			<span className={`absolute ${small ? "inset-x-3 bottom-2" : "inset-x-5 bottom-4"}`}>
				<span className={`block truncate font-semibold leading-tight ${small ? "text-[21px]" : "text-[27px]"}`}>{title.title}</span>
				{sub && <span className={`block truncate leading-tight text-[#fff4e6]/80 ${small ? "text-[20px]" : "text-[21px]"}`}>{sub}</span>}
			</span>
		</span>
	)
}

const Home: Skin["Home"] = ({ apps, greeting, open }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = apps.find((a) => `app-${a.key}` === tv.focus) ?? apps[0]
	const D = P ? 118 : 172
	return (
		<>
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`pointer-events-none absolute ${SOFT} ${P ? "left-5 top-[26px] text-[21px]" : "inset-x-0 top-9 text-center text-[28px]"}`}>{greeting}.</div>
			<div className={`absolute inset-x-0 flex overflow-hidden ${P ? "top-[70px] gap-5 px-5 py-5" : "top-[86px] justify-center gap-11 py-6"}`} style={{ scrollPadding: 30 }}>
				{apps.map((a, n) => (
					<div key={a.key} className={`flex shrink-0 flex-col items-center ${P ? "gap-2" : "gap-3"}`}>
						<F id={`app-${a.key}`} first={n === 0} onOk={() => open(a.key)} label={a.name} className="g-tile" style={{ width: D, height: D, borderRadius: "50%" }}>
							<AppArt app={a} className="absolute inset-0 h-full w-full" />
						</F>
						<span className={`font-semibold transition-opacity ${shown.key === a.key ? "" : "opacity-55"} ${P ? "text-[21px] leading-tight" : "text-[27px]"}`}>{a.name}</span>
					</div>
				))}
			</div>
			<div key={shown.key} className={`tvd-fade absolute inset-x-0 text-center ${P ? "bottom-7 px-5 [.tvd-short_&]:bottom-4" : "top-[344px]"}`}>
				<div className={`leading-snug ${P ? "text-[21px]" : "text-[34px]"}`}>{shown.line}</div>
			</div>
			{!P && (
				<div key={`${shown.key}-preview`} className="tvd-fade absolute inset-x-0 top-[420px] flex justify-center gap-6">
					{shown.preview.map((x) => (
						<Still key={x.key} title={x} className="rounded-[26px] opacity-80" style={{ width: 300, height: 200 }} />
					))}
				</div>
			)}
		</>
	)
}

const Moods: Skin["Moods"] = ({ moods, pick, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const B = useExpandAt() === "bottom"
	const shown = moods.find((m) => `mood-${m.key}` === tv.focus) ?? moods[0]
	const tiles = moods.map((m, n) => (
		<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => pick(m.key)} className={`g-tile flex flex-col justify-end ${P ? "p-3.5" : "p-6"}`} style={{ height: P ? undefined : B ? 190 : 206, background: `radial-gradient(130% 130% at 15% 0%, hsl(${m.hue} 62% 46%), hsl(${m.hue} 50% 15%))` }}>
			<span className={`font-semibold leading-none ${P ? "text-[22px]" : "text-[42px]"}`}>{m.name}</span>
			{!P && <span className="mt-2 text-[23px] leading-tight text-[#fff4e6]/85">{m.line}</span>}
		</F>
	))
	return (
		<Frame name="Discover" crumb="What kind of night?" dest={dest}>
			{P ? (
				// The phone: six moods three by three, and the focused one's line beside the expand key.
				<div className="flex h-full flex-col">
					<div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3">{tiles}</div>
					<Foot>
						<span className={`text-[20px] leading-tight ${SOFT}`}>{shown.line}</span>
					</Foot>
				</div>
			) : (
				<div className="grid grid-cols-3 gap-7 pt-3">{tiles}</div>
			)}
		</Frame>
	)
}

const List: Skin["List"] = ({ name, crumb, dest, items, actions, actionsLabel, empty }) => {
	const tv = useTv()
	const P = tv.phone
	const B = useExpandAt() === "bottom"
	const under = (i: (typeof items)[number]) => i.sub ?? `${metaOf(i.title)}${tv.taste ? ` · ${i.title.match}% match` : ""}`
	// The phone: two stills in a row, two rows in view and more paging in, the actions beside the expand key.
	if (P)
		return (
			<Frame name={name} crumb={crumb} dest={dest}>
				<div className="flex h-full flex-col">
					<div className="-mx-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-hidden px-5 py-2">
						{items.map((i, n) => (
							<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} className="g-tile h-[100px] [.tvd-short_&]:h-[84px]">
								<Still small title={i.title} sub={under(i)} className="h-full w-full" />
							</F>
						))}
						{!items.length && <div className="text-[28px]">{empty}</div>}
					</div>
					<Foot>
						{actions.slice(0, 2).map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="g-btn flex h-[54px] min-w-0 items-center px-5 text-[20px] leading-tight">
								<span className="truncate">{a.label}</span>
							</F>
						))}
					</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame name={name} crumb={crumb} dest={dest}>
			<div className="flex h-full items-start gap-8">
				{/* Two stills in a row; more rows page down as the focus moves. With the expand key in the bottom right corner the list ends above it. */}
				<div className={`-mx-14 -mb-4 -mt-12 grid min-w-0 flex-1 grid-cols-2 content-start gap-x-7 gap-y-6 overflow-hidden px-14 py-14 ${B ? "h-[calc(100%-34px)]" : "h-[calc(100%+64px)]"}`}>
					{items.map((i, n) => (
						<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} className="g-tile" style={{ height: 204 }}>
							<Still title={i.title} sub={under(i)} className="h-full w-full" />
						</F>
					))}
					{!items.length && <div className="text-[34px]">{empty}</div>}
				</div>
				{actions.length > 0 && (
					<div className="flex w-[220px] shrink-0 flex-col gap-3 pt-3">
						{actionsLabel && <span className={`text-[24px] ${SOFT}`}>{actionsLabel}</span>}
						{actions.map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="g-btn flex h-[72px] items-center justify-center px-4 text-center text-[25px] leading-tight">
								{a.label}
							</F>
						))}
					</div>
				)}
			</div>
		</Frame>
	)
}

/** Where the six islands sit on the sea, in canvas pixels inside the map. */
const AT: Record<string, [number, number]> = { heists: [30, 0], whodunits: [320, 54], "found-family": [620, 0], workplace: [160, 236], "time-loops": [480, 262], space: [910, 112] }
const BRIDGES = [
	["heists", "whodunits"],
	["whodunits", "found-family"],
	["heists", "workplace"],
	["workplace", "time-loops"],
	["time-loops", "found-family"],
	["time-loops", "space"],
	["space", "found-family"],
]

const IslandMap: Skin["Map"] = ({ open, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = ISLANDS.find((i) => `island-${i.key}` === tv.focus) ?? ISLANDS[0]
	const D = 152
	const orb = (hue: number) => `radial-gradient(circle at 35% 30%, hsl(${hue} 80% 70%), hsl(${hue} 65% 42%) 55%, hsl(${hue} 60% 22%))`
	return (
		<Frame name="Explorer" crumb="Six islands" dest={dest}>
			{P ? (
				// The phone: the six islands three by three; the corner under them is the expand key's.
				<div className="grid grid-cols-3 gap-x-2 gap-y-1 pt-2">
					{ISLANDS.map((i, n) => (
						<div key={i.key} className="flex flex-col items-center gap-1">
							<F id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} label={i.name} className="g-tile h-[82px] w-[82px] [.tvd-short_&]:h-[70px] [.tvd-short_&]:w-[70px]" style={{ borderRadius: "50%", background: orb(i.hue) }}>
								{null}
							</F>
							<span className="whitespace-nowrap text-[20px] font-semibold leading-tight">{i.name}</span>
						</div>
					))}
				</div>
			) : (
				<div className="relative h-full">
					<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
						{BRIDGES.map(([a, b]) => (
							<line key={a + b} x1={AT[a][0] + D / 2} y1={AT[a][1] + D / 2} x2={AT[b][0] + D / 2} y2={AT[b][1] + D / 2} stroke="rgba(253,186,116,.4)" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" />
						))}
					</svg>
					{ISLANDS.map((i, n) => (
						<div key={i.key}>
							<F id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} label={i.name} className="g-tile absolute" style={{ left: AT[i.key][0], top: AT[i.key][1], width: D, height: D, borderRadius: "50%", background: orb(i.hue) }}>
								{null}
							</F>
							<span className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-[#150d09]/85 px-4 text-[28px] font-semibold transition-colors ${shown.key === i.key ? "text-amber-200" : "text-[#fff4e6]/60"}`} style={{ left: AT[i.key][0] + D / 2, top: AT[i.key][1] + D + 18 }}>
								{i.name}
							</span>
						</div>
					))}
				</div>
			)}
		</Frame>
	)
}

const TitleView: Skin["TitleView"] = ({ name, crumb, title, kicker, actions, dest }) => {
	const tv = useTv()
	const P = tv.phone
	return (
		<Frame name={name} crumb={crumb} dest={dest} art={backdropOf(title, "w1280")}>
			<div className={`flex min-h-full flex-col ${P ? "justify-end" : "justify-center"}`}>
				<div className={`flex ${P ? "flex-col" : "items-center gap-12"}`}>
					<div className="min-w-0 flex-1">
						{!P && <div className={`font-semibold uppercase tracking-[0.16em] ${SOFT} ${P ? "text-[20px]" : "text-[22px]"}`}>{kicker}</div>}
						<div className="mt-2 font-semibold leading-[1.0] tracking-tight" style={{ fontSize: P ? titleSize(title.title, 42, 32) : titleSize(title.title, 80, 56) }}>
							{title.title}
						</div>
						<div className={`flex flex-wrap ${P ? "mt-2.5 gap-x-5 text-[21px]" : "mt-4 gap-x-6 text-[28px]"}`}>
							<span>
								<b className="font-semibold text-amber-300">{title.score}</b> score
							</span>
							{tv.taste && (
								<span>
									<b className="font-semibold text-amber-300">{title.match}%</b> match
								</span>
							)}
							<span className="text-[#fff4e6]/80">On {title.service}</span>
						</div>
						{!P && <div className={`mt-3 leading-snug text-[#fff4e6]/90 ${P ? "text-[20px]" : "text-[26px]"}`}>{title.line}</div>}
					</div>
					{!P && <Img src={backdropOf(title, "w780")} className="h-[250px] w-[430px] shrink-0 rounded-[36px] shadow-[0_0_90px_10px_rgba(251,146,60,.28),0_0_0_2px_rgba(253,186,116,.5)]" />}
				</div>
				{/* The actions sit in one row under both, so Left and Right reach every one of them. */}
				<div className={`flex ${P ? "mt-3.5 w-[292px] flex-col gap-2" : "mt-9 gap-4"}`}>
					{actions.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`g-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[52px] shrink-0 text-[21px] [.tvd-short_&]:h-[46px]" : "h-[72px] px-9 text-[26px]"}`}>
							{a.label}
						</F>
					))}
				</div>
			</div>
		</Frame>
	)
}

const Taste: Skin["Taste"] = ({ rated, start, dest }) => {
	const P = useTv().phone
	return (
		<Frame name="Taste" dest={dest}>
			{/* The phone: the corner under the words is the expand key's, so they stand above it. */}
			<div className={`flex flex-col items-center justify-center text-center ${P ? "h-full pb-[64px]" : "min-h-full"}`}>
				<div className="font-semibold leading-[1.05] tracking-tight" style={{ fontSize: P ? 32 : 64 }}>
					Rate 5 titles you've seen.
				</div>
				<div className={`${SOFT} ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}>{rated} of 5 rated. Then GoodWatch knows your taste.</div>
				<F id={start.id} first onOk={start.onOk} className={`g-btn flex items-center ${P ? "mt-4 h-[52px] px-8 text-[21px]" : "mt-9 h-[76px] px-11 text-[30px]"}`}>
					{start.label}
				</F>
			</div>
		</Frame>
	)
}

const Sides: Skin["Sides"] = ({ open, more, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = SIDES.find((s) => `side-${s.key}` === tv.focus) ?? SIDES[0]
	const tiles = SIDES.map((s, n) => (
		<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => open(s.key)} className="g-tile" style={{ height: P ? undefined : 280 }}>
			<Img src={backdropOf(s.titles[0])} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0 bg-gradient-to-t from-[#120a06]/95 via-[#120a06]/35 to-transparent" />
			<span className={`absolute ${P ? "inset-x-3 bottom-3" : "inset-x-6 bottom-5"}`}>
				<span className={`block font-semibold leading-none ${P ? "text-[22px]" : "text-[38px]"}`}>{s.name}</span>
				{!P && <span className="mt-2 block text-[23px] leading-tight text-[#fff4e6]/85">{s.line}</span>}
			</span>
		</F>
	))
	const again = (
		<F id={more.id} onOk={more.onOk} className={`g-btn flex items-center ${P ? "h-[54px] px-6 text-[21px]" : "h-[72px] px-10 text-[27px]"}`}>
			{more.label}
		</F>
	)
	return (
		<Frame name="Taste" crumb="Three sides of you" dest={dest}>
			{P ? (
				// The phone: the three sides side by side, the focused one's line over them, the action beside the expand key.
				<div className="flex h-full flex-col">
					<div className={`shrink-0 truncate text-[20px] leading-tight ${SOFT}`}>{shown.line}</div>
					<div className="mt-2.5 grid min-h-0 flex-1 grid-cols-3 gap-3">{tiles}</div>
					<Foot>{again}</Foot>
				</div>
			) : (
				<>
					<div className="grid grid-cols-3 gap-7 pt-3">{tiles}</div>
					<div className="mt-8 flex justify-center">{again}</div>
				</>
			)}
		</Frame>
	)
}

const Ask: Skin["Ask"] = ({ kicker, question, line, answers, title }) => {
	const P = useTv().phone
	return (
		<>
			{title && <Ambient src={backdropOf(title, "w1280")} className="opacity-[0.16]" />}
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${P ? "px-5 pb-3 pt-[70px]" : "px-14 pt-16"}`}>
				<div className={`font-semibold uppercase tracking-[0.16em] ${SOFT} ${P ? "text-[20px]" : "text-[22px]"}`}>{kicker}</div>
				<div className={`font-semibold leading-[1.05] tracking-tight ${P ? "mt-1" : "mt-3"}`} style={{ fontSize: P ? 30 : titleSize(question, 72, 54) }}>
					{question}
				</div>
				{line && <div className={`${SOFT} ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}>{line}</div>}
				<div className={`grid w-full ${P ? "mt-4 gap-2.5" : "mt-11 gap-6"}`} style={{ gridTemplateColumns: `repeat(${P ? 2 : answers.length}, minmax(0, 1fr))` }}>
					{answers.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`g-btn flex items-center justify-center px-4 text-center leading-tight ${P ? "h-[52px] text-[21px] [.tvd-short_&]:h-[46px]" : "h-[108px] text-[30px]"}`}>
							{a.label}
						</F>
					))}
				</div>
			</div>
		</>
	)
}

const Menu: Skin["Menu"] = ({ items }) => {
	const P = useTv().phone
	return (
		<div className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-4 rounded-[44px] bg-[#1d130d] shadow-[0_0_120px_20px_rgba(251,146,60,.22),0_0_0_1.5px_rgba(253,186,116,.3)] ${P ? "inset-x-5 !gap-2 !rounded-[30px] px-4 py-3.5" : "right-10 w-[440px] p-9"}`}>
			<div className={`px-4 font-semibold uppercase tracking-[0.2em] ${SOFT} ${P ? "text-[20px]" : "text-[22px]"}`}>Menu</div>
			{items.map((item, n) => (
				<F key={item.id} id={item.id} first={n === 0} onOk={item.onOk} className={`g-btn flex items-center px-9 ${P ? "h-[46px] shrink-0 !px-6 text-[21px]" : "h-[72px] text-[28px]"}`}>
					{item.label}
				</F>
			))}
		</div>
	)
}

export const glow: Skin = { css: CSS, Home, Moods, List, Map: IslandMap, TitleView, Taste, Sides, Ask, Menu }
