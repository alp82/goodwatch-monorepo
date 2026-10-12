// PROTOTYPE - throwaway. Direction "Marquee": words and colour do the work. Flat colour fields, the brand font at
// its heaviest and largest, square corners. Nothing grows on focus: one white ring glides from item to item (the
// Follower in scene.tsx) and the focused tile comes into full colour while the rest are muted. The background is a
// field of the focused item's colour. Screens push in from the side they come from.
import type { ReactNode } from "react"
import { type Dest, ISLANDS, SIDES } from "~/ui/prototype-tv-flow/data"
import { useTv } from "~/ui/prototype-tv-flow/engine"
import { F } from "~/ui/prototype-tv-flow/kit"
import { posterOf } from "./art"
import { Actions, BarTitle, Corner, Img, type Skin, titleSize, useExpandAt, useFocusedTitle } from "./base"

const CSS = `
.tvd-marquee { color: #fff; background: #0c0c10; }
.tvd-marquee .tvf { border-radius: 6px; transition: filter .12s, background-color .12s, color .12s; }
.tvd-marquee .m-tile { overflow: hidden; filter: saturate(.55) brightness(.6); }
.tvd-marquee .m-tile.tvf-on { filter: none; }
.tvd-marquee .m-btn { background: #26262e; font-weight: 800; }
.tvd-marquee .m-btn.tvf-on { background: #fff; color: #000; }
.tvd-marquee .m-act { background: #26262e; font-weight: 900; text-transform: uppercase; }
.tvd-marquee .m-act.tvf-on { background: #fff; color: #000; }
.tvd-marquee .m-x { background: #fbbf24; color: #000; font-weight: 900; text-transform: uppercase; letter-spacing: .02em; }
.tvd-marquee .m-x.tvf-on { background: #fff; }
.tvd-marquee .m-menu { font-weight: 900; text-transform: uppercase; color: #000; }
.tvd-marquee .m-menu.tvf-on { background: #000; color: #fff; }
.tvd-marquee .m-ring { z-index: 20; box-shadow: 0 0 0 6px #fff, 0 0 0 9px rgba(0,0,0,.55); }
.tvd-marquee .m-field { transition: background-color .3s ease-out; }
.tvd-marquee .tvd-screen { animation: m-in .24s cubic-bezier(.2,.9,.2,1) both; }
@keyframes m-in { from { opacity: 0; transform: translateX(calc(var(--nav) * 140px)); } }
.tvd-marquee .tvd-menu { background: rgba(0,0,0,.6); animation: tvd-fade .15s both; }
.tvd-marquee .tvd-toast { background: #fff; color: #000; border-radius: 6px; padding: 12px 28px; font-size: 26px; font-weight: 900; text-transform: uppercase; }
`

const hsl = (hue: number, s: number, l: number) => `hsl(${hue} ${s}% ${l}%)`

/** The colour field behind a screen: the focused item's colour, falling off to black on the right. */
function Field({ hue }: { hue: number }) {
	return (
		<>
			<div className="m-field absolute inset-0" style={{ backgroundColor: hsl(hue, 62, 26) }} />
			<div className="absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(12,12,16,0) 0%, rgba(12,12,16,.7) 45%, #0c0c10 78%)" }} />
		</>
	)
}

const X = { phone: "m-x gap-3 h-[54px] px-3.5 text-[20px]", desk: "m-x gap-4 h-[72px] px-6 text-[26px]" }
const MOTIF = { phone: { w: 42, h: 32, stroke: 4 }, desk: { w: 60, h: 44, stroke: 5 } }

/** The actions as this direction draws them: dark blocks in capitals, and the expand key as the one amber block. */
function Bar({ dest, className }: { dest?: Dest; className?: string }) {
	const P = useTv().phone
	return <Actions dest={dest} className={className} cls={P ? "m-act h-[54px] w-[54px]" : "m-act h-[72px] gap-2.5 px-5 text-[22px]"} xcls={P ? X.phone : X.desk} motif={P ? MOTIF.phone : MOTIF.desk} />
}

/** The expand key in the picture's bottom right corner: on the phone always, on the desktop as the third place. */
function Out({ dest }: { dest: Dest }) {
	const P = useTv().phone
	return <Corner dest={dest} className={P ? X.phone : X.desk} motif={P ? MOTIF.phone : MOTIF.desk} at={P ? "bottom-5 right-5" : "bottom-10 right-14"} />
}

function Frame({ name, crumb, dest, hue, children }: { name: string; crumb?: string; dest: Dest; hue: number; children: ReactNode }) {
	const P = useTv().phone
	return (
		<>
			<Field hue={hue} />
			<div className={`absolute inset-x-0 top-0 flex gap-4 ${P ? "h-[78px] items-center justify-between px-5" : "h-[116px] items-center justify-between px-14"}`}>
				<BarTitle name={name} crumb={crumb} nameClass="font-black uppercase tracking-tight" style={{ fontSize: P ? 20 : 50 }} crumbClass={`font-bold text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`} />
				<Bar dest={dest} />
			</div>
			<div className={`absolute inset-x-0 bottom-0 ${P ? "top-[78px] overflow-hidden px-5 pb-5" : "top-[116px] px-14 pb-10"}`}>{children}</div>
			<Out dest={dest} />
		</>
	)
}

/** The phone's last row: what a screen puts beside the expand key, which has the right end of it. */
function Foot({ children }: { children?: ReactNode }) {
	return <div className="mt-2.5 flex h-[54px] shrink-0 items-center gap-2 pr-[158px]">{children}</div>
}

/** Each app's sign: one large flat shape, drawn in the tile's ink. */
function Glyph({ app, className }: { app: string; className?: string }) {
	const ink = "currentColor"
	return (
		<svg viewBox="0 0 100 100" className={className} aria-hidden="true">
			{app === "tonight" && (
				<>
					<path d="M60 10a41 41 0 1 0 31 62A34 34 0 0 1 60 10z" fill={ink} />
					<circle cx="78" cy="26" r="6" fill={ink} />
				</>
			)}
			{app === "discover" && (
				<>
					<rect x="8" y="8" width="38" height="38" rx="6" fill={ink} />
					<rect x="54" y="8" width="38" height="38" rx="6" fill="none" stroke={ink} strokeWidth="8" />
					<rect x="8" y="54" width="38" height="38" rx="6" fill="none" stroke={ink} strokeWidth="8" />
					<rect x="54" y="54" width="38" height="38" rx="6" fill={ink} />
				</>
			)}
			{app === "explorer" && (
				<>
					<path d="M24 30L70 24L78 70L34 78z" fill="none" stroke={ink} strokeWidth="5" strokeDasharray="1 10" strokeLinecap="round" />
					<ellipse cx="24" cy="30" rx="18" ry="13" fill={ink} />
					<ellipse cx="72" cy="24" rx="15" ry="11" fill={ink} />
					<ellipse cx="78" cy="72" rx="17" ry="12" fill={ink} />
					<ellipse cx="32" cy="78" rx="14" ry="10" fill={ink} />
				</>
			)}
			{app === "taste" &&
				[14, 28, 42].map((r) => <path key={r} d={`M${50 - r} 64a${r} ${r} 0 0 1 ${r * 2} 0v${r > 14 ? 22 : 12}`} fill="none" stroke={ink} strokeWidth="9" strokeLinecap="round" />)}
			{app === "shows" && (
				<>
					<path d="M26 8l52 30-52 30z" fill={ink} />
					<rect x="10" y="80" width="34" height="12" rx="6" fill={ink} />
					<rect x="50" y="80" width="18" height="12" rx="6" fill={ink} opacity=".55" />
					<rect x="74" y="80" width="18" height="12" rx="6" fill={ink} opacity=".55" />
				</>
			)}
		</svg>
	)
}

const Home: Skin["Home"] = ({ apps, greeting, open }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = apps.find((a) => `app-${a.key}` === tv.focus) ?? apps[0]
	return (
		<>
			<Field hue={shown.hue} />
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`absolute ${P ? "left-5 top-[18px]" : "left-14 top-10"}`}>
				<div className={`font-black uppercase tracking-[0.2em] text-white/75 ${P ? "text-[20px]" : "text-[22px]"}`}>GoodWatch</div>
				<div className="mt-1 font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 30 : 66 }}>
					{greeting}.
				</div>
			</div>
			{/* The phone: the tiles take the height that is left under the greeting. */}
			<div className={`absolute inset-x-0 flex overflow-hidden ${P ? "bottom-0 top-[86px] gap-3.5 px-5 pb-5 pt-3" : "top-[150px] gap-6 px-14 py-4"}`} style={{ scrollPadding: 30 }}>
				{apps.map((a, n) => (
					<F key={a.key} id={`app-${a.key}`} first={n === 0} onOk={() => open(a.key)} className={`m-tile flex shrink-0 flex-col justify-between ${P ? "p-4" : "p-5"}`} style={{ width: P ? 172 : 198, height: P ? "100%" : 286, background: hsl(a.hue, 68, 46) }}>
						<Glyph app={a.key} className={P ? "h-[104px] w-[104px] [.tvd-short_&]:h-[84px] [.tvd-short_&]:w-[84px]" : "h-[150px] w-[150px]"} />
						<span className="font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 27 : 32 }}>
							{a.name}
						</span>
					</F>
				))}
			</div>
			<div hidden={P} className="absolute inset-x-0 bottom-0 flex h-[188px] items-end justify-between gap-8 overflow-hidden px-14">
				<div key={shown.key} className={`tvd-fade self-center font-extrabold leading-tight ${P ? "text-[26px]" : "max-w-[520px] text-[36px]"}`}>
					{shown.line}
				</div>
				{!P && (
					<div className="flex shrink-0 translate-y-[38px] gap-4">
						{shown.preview.map((x) => (
							<Img key={x.key} src={posterOf(x)} className="h-[216px] w-[144px] rounded-[6px]" />
						))}
					</div>
				)}
			</div>
		</>
	)
}

const Moods: Skin["Moods"] = ({ moods, pick, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const B = useExpandAt() === "bottom"
	const shown = moods.find((m) => `mood-${m.key}` === tv.focus) ?? moods[0]
	const tiles = moods.map((m, n) => (
		<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => pick(m.key)} className={`m-tile flex flex-col justify-end ${P ? "p-3" : "p-5"}`} style={{ height: P ? undefined : B ? 190 : 216, background: hsl(m.hue, 66, 44) }}>
			<span className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 21 : titleSize(m.name, 56, 40) }}>
				{m.name}
			</span>
			{!P && <span className="mt-2 text-[24px] font-bold leading-tight">{m.line}</span>}
		</F>
	))
	return (
		<Frame name="Discover" crumb="What kind of night?" dest={dest} hue={shown.hue}>
			{P ? (
				// The phone: six moods three by three, and the focused one's line beside the expand key.
				<div className="flex h-full flex-col">
					<div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3 pt-1">{tiles}</div>
					<Foot>
						<span className="text-[20px] font-bold leading-tight">{shown.line}</span>
					</Foot>
				</div>
			) : (
				<div className="grid grid-cols-3 gap-6 pt-2">{tiles}</div>
			)}
		</Frame>
	)
}

const List: Skin["List"] = ({ name, crumb, dest, items, actions, actionsLabel, empty }) => {
	const tv = useTv()
	const P = tv.phone
	const x = useFocusedTitle(items)
	const under = (i: (typeof items)[number]) => i.sub ?? (tv.taste ? `${i.title.match}% match` : `${i.title.score} score`)
	// The phone: the posters as tall as is left, their captions under them, the actions beside the expand key.
	if (P)
		return (
			<Frame name={name} crumb={crumb} dest={dest} hue={x?.hue ?? 220}>
				<div className="flex h-full flex-col">
					<div className="-mx-5 flex min-h-0 flex-1 gap-3 overflow-hidden px-5 py-2.5" style={{ scrollPadding: 24 }}>
						{items.map((i, n) => (
							<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} className="m-tile flex h-full w-[118px] shrink-0 flex-col bg-[#17171c]">
								<Img src={posterOf(i.title)} className="min-h-0 w-full flex-1" />
								{/* A tile this narrow holds the name on two lines, or on one over the episode. */}
								<span className="flex h-[56px] shrink-0 flex-col justify-center px-2">
									<span className={`text-[20px] font-black uppercase leading-[1.05] ${i.sub ? "truncate" : "line-clamp-2"}`}>{i.title.title}</span>
									{i.sub && <span className="truncate text-[20px] font-bold leading-tight text-white/70">{i.sub.split(" · ")[0]}</span>}
								</span>
							</F>
						))}
						{!items.length && <div className="text-[30px] font-black uppercase">{empty}</div>}
					</div>
					<Foot>
						{actions.slice(0, 2).map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="m-btn flex h-[54px] min-w-0 items-center px-4 text-[20px] leading-tight">
								<span className="truncate">{a.label}</span>
							</F>
						))}
					</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame name={name} crumb={crumb} dest={dest} hue={x?.hue ?? 220}>
			<div className="flex h-full items-start gap-8">
				<div className="-mx-5 flex min-w-0 flex-1 gap-5 overflow-hidden px-5 py-4" style={{ scrollPadding: 30 }}>
					{items.map((i, n) => (
						<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} className="m-tile flex shrink-0 flex-col bg-[#17171c]" style={{ width: 188 }}>
							<Img src={posterOf(i.title)} className="w-full" style={{ height: 282 }} />
							<span className="flex h-[104px] flex-col justify-center px-3">
								<span className="line-clamp-2 text-[23px] font-black uppercase leading-[1.02]">{i.title.title}</span>
								<span className="mt-1 truncate text-[20px] font-bold text-white/70">{under(i)}</span>
							</span>
						</F>
					))}
					{!items.length && <div className="font-black uppercase" style={{ fontSize: 60 }}>{empty}</div>}
				</div>
				{actions.length > 0 && (
					<div className="flex w-[230px] shrink-0 flex-col gap-3 pt-4">
						{actionsLabel && <span className="text-[24px] font-black uppercase text-white/70">{actionsLabel}</span>}
						{actions.map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="m-btn flex h-[84px] items-center justify-center px-4 text-center text-[26px] leading-tight">
								{a.label}
							</F>
						))}
					</div>
				)}
			</div>
		</Frame>
	)
}

/** Where the six islands sit, in canvas pixels inside the map. */
const AT: Record<string, [number, number]> = { heists: [10, 16], whodunits: [420, 44], "found-family": [836, 8], workplace: [140, 232], "time-loops": [506, 300], space: [836, 220] }
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
	const W = 244
	const H = 120
	const island = (i: (typeof ISLANDS)[number], n: number, style?: object) => (
		<F key={i.key} id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} className={`m-tile flex items-center justify-center text-center ${P ? "" : "absolute"}`} style={{ borderRadius: 999, background: hsl(i.hue, 66, 46), height: P ? 76 : H, ...style }}>
			<span className="font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 20 : 28 }}>
				{i.name}
			</span>
		</F>
	)
	return (
		<Frame name="Explorer" crumb="Six islands" dest={dest} hue={shown.hue}>
			{P ? (
				// The phone: the six islands three by three; the corner under them is the expand key's.
				<div className="grid grid-cols-3 gap-3 pt-2">{ISLANDS.map((i, n) => island(i, n))}</div>
			) : (
				<div className="relative h-full">
					<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
						{BRIDGES.map(([a, b]) => (
							<line key={a + b} x1={AT[a][0] + W / 2} y1={AT[a][1] + H / 2} x2={AT[b][0] + W / 2} y2={AT[b][1] + H / 2} stroke="rgba(255,255,255,.3)" strokeWidth="6" />
						))}
					</svg>
					{ISLANDS.map((i, n) => island(i, n, { left: AT[i.key][0], top: AT[i.key][1], width: W }))}
				</div>
			)}
		</Frame>
	)
}

const TitleView: Skin["TitleView"] = ({ name, crumb, title, kicker, actions, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const B = useExpandAt() === "bottom"
	return (
		<>
			<div className="absolute inset-0" style={{ background: hsl(title.hue, 58, 24) }} />
			{/* With the expand key in the bottom right corner the poster ends above it. */}
			{!P && <Img src={posterOf(title, "w500")} className={`absolute right-0 top-0 w-[34%] ${B ? "bottom-[136px]" : "bottom-0"}`} />}
			<div className={`absolute inset-x-0 top-0 flex gap-4 ${P ? "h-[78px] items-center justify-between px-5" : "h-[116px] items-center justify-between px-14"}`}>
				<BarTitle name={name} crumb={crumb} nameClass={`font-black uppercase tracking-[0.14em] text-white/80 ${P ? "text-[22px]" : "text-[28px]"}`} crumbClass={`font-bold text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`} />
				<Bar dest={dest} />
			</div>
			<Out dest={dest} />
			<div className={`absolute bottom-0 flex flex-col justify-end ${P ? "inset-x-0 top-[78px] px-5 pb-5" : "left-0 top-[116px] w-[66%] pb-10 pl-14 pr-8"}`}>
				{!P && <div className="text-[24px] font-black uppercase tracking-[0.1em] text-white/80">{kicker}</div>}
				<div className="mt-2 font-black uppercase leading-[0.88] tracking-tight" style={{ fontSize: P ? titleSize(title.title, 44, 32) : titleSize(title.title, 104, 62) }}>
					{title.title}
				</div>
				<div className={`flex flex-wrap font-black uppercase ${P ? "mt-2.5 gap-x-4 text-[20px]" : "mt-4 gap-x-6 text-[30px]"}`}>
					<span>{title.score} score</span>
					{tv.taste && <span>{title.match}% match</span>}
					<span className="text-white/80">On {title.service}</span>
				</div>
				{!P && <div className={`mt-2 font-semibold leading-snug text-white/90 ${P ? "text-[20px]" : "text-[26px]"}`}>{title.line}</div>}
				{/* The phone: the actions in a column on the left; the corner beside the last one is the expand key's. */}
				<div className={`flex ${P ? "mt-3.5 w-[292px] flex-col gap-2" : "mt-7 flex-wrap gap-4"}`}>
					{actions.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`m-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[52px] shrink-0 text-[20px] [.tvd-short_&]:h-[46px]" : "h-[80px] px-6 text-[25px]"}`}>
							{a.label}
						</F>
					))}
				</div>
			</div>
		</>
	)
}

const Taste: Skin["Taste"] = ({ rated, start, dest }) => {
	const P = useTv().phone
	return (
		<Frame name="Taste" dest={dest} hue={265}>
			<div className="flex min-h-full flex-col justify-center">
				<div className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 38 : 88 }}>
					Rate 5 titles you've seen.
				</div>
				<div className={`font-bold text-white/85 ${P ? "mt-2 text-[20px]" : "mt-4 text-[30px]"}`}>{rated} of 5 rated. Then GoodWatch knows your taste.</div>
				<div className={`flex ${P ? "mt-5" : "mt-8"}`}>
					<F id={start.id} first onOk={start.onOk} className={`m-btn flex items-center uppercase ${P ? "h-[54px] px-6 text-[21px]" : "h-[84px] px-10 text-[30px]"}`}>
						{start.label}
					</F>
				</div>
			</div>
		</Frame>
	)
}

const Sides: Skin["Sides"] = ({ open, more, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = SIDES.find((s) => `side-${s.key}` === tv.focus) ?? SIDES[0]
	const tiles = SIDES.map((s, n) => (
		<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => open(s.key)} className={`m-tile flex flex-col justify-end ${P ? "p-3" : "p-5"}`} style={{ height: P ? undefined : 290, background: hsl(s.hue, 62, 44) }}>
			<span className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 22 : 50 }}>
				{s.name}
			</span>
			{!P && <span className="mt-2 text-[24px] font-bold leading-tight">{s.line}</span>}
		</F>
	))
	const again = (
		<F id={more.id} onOk={more.onOk} className={`m-btn flex items-center uppercase ${P ? "h-[54px] px-5 text-[20px]" : "h-[80px] px-9 text-[28px]"}`}>
			{more.label}
		</F>
	)
	return (
		<Frame name="Taste" crumb="Three sides of you" dest={dest} hue={shown.hue}>
			{P ? (
				// The phone: the three sides side by side, the focused one's line over them, the action beside the expand key.
				<div className="flex h-full flex-col">
					<div className="shrink-0 truncate text-[20px] font-bold leading-tight">{shown.line}</div>
					<div className="mt-2.5 grid min-h-0 flex-1 grid-cols-3 gap-3">{tiles}</div>
					<Foot>{again}</Foot>
				</div>
			) : (
				<>
					<div className="grid grid-cols-3 gap-6 pt-2">{tiles}</div>
					<div className="mt-7 flex">{again}</div>
				</>
			)}
		</Frame>
	)
}

const Ask: Skin["Ask"] = ({ kicker, question, line, answers, title }) => {
	const P = useTv().phone
	return (
		<>
			<Field hue={title?.hue ?? 265} />
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[70px]" : "px-14 pt-16"}`}>
				<div className={`font-black uppercase tracking-[0.14em] text-white/80 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className={`font-black uppercase leading-[0.92] tracking-tight ${P ? "mt-1" : "mt-2"}`} style={{ fontSize: P ? 32 : titleSize(question, 96, 64) }}>
					{question}
				</div>
				{line && <div className={`font-bold text-white/85 ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}>{line}</div>}
				<div className={`grid ${P ? "mt-4 gap-2.5" : "mt-10 gap-5"}`} style={{ gridTemplateColumns: `repeat(${P ? 2 : answers.length}, minmax(0, 1fr))` }}>
					{answers.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`m-btn flex items-center justify-center px-4 text-center uppercase leading-tight ${P ? "h-[52px] text-[20px] [.tvd-short_&]:h-[46px]" : "h-[124px] text-[30px]"}`}>
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
		<div className={`absolute inset-y-0 right-0 flex flex-col justify-center gap-2 bg-white text-black ${P ? "w-[78%] px-4" : "w-[470px] px-8"}`}>
			<div className={`px-5 font-black uppercase tracking-[0.2em] text-black/55 ${P ? "text-[20px]" : "mb-3 text-[22px]"}`}>Menu</div>
			{items.map((item, n) => (
				<F key={item.id} id={item.id} first={n === 0} onOk={item.onOk} className={`m-menu flex items-center px-5 leading-none ${P ? "h-[48px] shrink-0 text-[21px]" : "h-[84px] text-[32px]"}`}>
					{item.label}
				</F>
			))}
		</div>
	)
}

export const marquee: Skin = { css: CSS, Home, Moods, List, Map: IslandMap, TitleView, Taste, Sides, Ask, Menu }
