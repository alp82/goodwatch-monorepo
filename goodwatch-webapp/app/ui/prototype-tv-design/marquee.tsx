// PROTOTYPE - throwaway. Direction "Marquee": words and colour do the work. Flat colour fields, the brand font at
// its heaviest and largest, square corners. Nothing grows on focus: one white ring glides from item to item (the
// Follower in scene.tsx) and the focused tile comes into full colour while the rest are muted. The background is a
// field of the focused item's colour. Screens push in from the side they come from.
import type { ReactNode } from "react"
import { type Dest, ISLANDS, SIDES } from "~/ui/prototype-tv-flow/data"
import { useTv } from "~/ui/prototype-tv-flow/engine"
import { F } from "~/ui/prototype-tv-flow/kit"
import { posterOf } from "./art"
import { Expand, Img, type Skin, titleSize, useFocusedTitle } from "./base"

const CSS = `
.tvd-marquee { color: #fff; background: #0c0c10; }
.tvd-marquee .tvf { border-radius: 6px; transition: filter .12s, background-color .12s, color .12s; }
.tvd-marquee .m-tile { overflow: hidden; filter: saturate(.55) brightness(.6); }
.tvd-marquee .m-tile.tvf-on { filter: none; }
.tvd-marquee .m-btn { background: #26262e; font-weight: 800; }
.tvd-marquee .m-btn.tvf-on { background: #fff; color: #000; }
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

function Frame({ name, crumb, dest, hue, children }: { name: string; crumb?: string; dest: Dest; hue: number; children: ReactNode }) {
	const P = useTv().phone
	return (
		<>
			<Field hue={hue} />
			<div className={`absolute inset-x-0 top-0 flex items-center justify-between gap-4 ${P ? "h-[92px] px-6" : "h-[116px] px-14"}`}>
				<div className="flex min-w-0 items-baseline gap-5">
					<span className="shrink-0 font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 36 : 62 }}>
						{name}
					</span>
					{crumb && <span className={`truncate font-bold text-white/75 ${P ? "text-[22px]" : "text-[30px]"}`}>{crumb}</span>}
				</div>
				<Expand dest={dest} className={`m-x gap-4 ${P ? "h-[58px] px-5 text-[22px]" : "h-[72px] px-7 text-[28px]"}`} motif={{ w: 60, h: 44, stroke: 5 }} />
			</div>
			<div className={`absolute inset-x-0 bottom-0 ${P ? "top-[92px] overflow-hidden px-6 pb-6" : "top-[116px] px-14 pb-10"}`}>{children}</div>
		</>
	)
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
			<div className={`absolute ${P ? "left-6 top-7" : "left-14 top-10"}`}>
				<div className={`font-black uppercase tracking-[0.2em] text-white/75 ${P ? "text-[20px]" : "text-[22px]"}`}>GoodWatch</div>
				<div className="mt-1 font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 40 : 66 }}>
					{greeting}.
				</div>
			</div>
			<div className={`absolute inset-x-0 flex overflow-hidden ${P ? "top-[130px] gap-4 px-6 py-3" : "top-[150px] gap-6 px-14 py-4"}`} style={{ scrollPadding: 30 }}>
				{apps.map((a, n) => (
					<F key={a.key} id={`app-${a.key}`} first={n === 0} onOk={() => open(a.key)} className="m-tile flex shrink-0 flex-col justify-between p-5" style={{ width: P ? 190 : 198, height: P ? 250 : 286, background: hsl(a.hue, 68, 46) }}>
						<Glyph app={a.key} className={P ? "h-[120px] w-[120px]" : "h-[150px] w-[150px]"} />
						<span className="font-black uppercase leading-none tracking-tight" style={{ fontSize: 32 }}>
							{a.name}
						</span>
					</F>
				))}
			</div>
			<div className={`absolute inset-x-0 bottom-0 flex items-end justify-between gap-8 overflow-hidden ${P ? "h-[220px] px-6" : "h-[188px] px-14"}`}>
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
	const shown = moods.find((m) => `mood-${m.key}` === tv.focus) ?? moods[0]
	return (
		<Frame name="Discover" crumb="What kind of night?" dest={dest} hue={shown.hue}>
			<div className={`grid ${P ? "grid-cols-2 gap-4" : "grid-cols-3 gap-6 pt-2"}`}>
				{moods.map((m, n) => (
					<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => pick(m.key)} className="m-tile flex flex-col justify-end p-5" style={{ height: P ? 150 : 216, background: hsl(m.hue, 66, 44) }}>
						<span className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 28 : titleSize(m.name, 56, 40) }}>
							{m.name}
						</span>
						<span className={`mt-2 font-bold leading-tight ${P ? "text-[20px]" : "text-[24px]"}`}>{m.line}</span>
					</F>
				))}
			</div>
		</Frame>
	)
}

const List: Skin["List"] = ({ name, crumb, dest, items, actions, actionsLabel, empty }) => {
	const tv = useTv()
	const P = tv.phone
	const x = useFocusedTitle(items)
	return (
		<Frame name={name} crumb={crumb} dest={dest} hue={x?.hue ?? 220}>
			<div className={`flex h-full ${P ? "flex-col gap-3" : "items-start gap-8"}`}>
				<div className="-mx-5 flex min-w-0 flex-1 gap-5 overflow-hidden px-5 py-4" style={{ scrollPadding: 30 }}>
					{items.map((i, n) => (
						<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} className="m-tile flex shrink-0 flex-col bg-[#17171c]" style={{ width: P ? 170 : 188 }}>
							<Img src={posterOf(i.title)} className="w-full" style={{ height: P ? 255 : 282 }} />
							<span className={`flex flex-col justify-center px-3 ${P ? "h-[88px]" : "h-[104px]"}`}>
								<span className={`line-clamp-2 font-black uppercase leading-[1.02] ${P ? "text-[20px]" : "text-[23px]"}`}>{i.title.title}</span>
								<span className="mt-1 truncate text-[20px] font-bold text-white/70">{i.sub ?? (tv.taste ? `${i.title.match}% match` : `${i.title.score} score`)}</span>
							</span>
						</F>
					))}
					{!items.length && <div className="font-black uppercase" style={{ fontSize: P ? 34 : 60 }}>{empty}</div>}
				</div>
				{actions.length > 0 && (
					<div className={`flex shrink-0 gap-3 ${P ? "items-center" : "w-[230px] flex-col pt-4"}`}>
						{actionsLabel && <span className="text-[24px] font-black uppercase text-white/70">{actionsLabel}</span>}
						{actions.map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className={`m-btn flex items-center justify-center text-center leading-tight ${P ? "h-[60px] px-5 text-[21px]" : "h-[84px] px-4 text-[26px]"}`}>
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
		<F key={i.key} id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} className={`m-tile flex items-center justify-center text-center ${P ? "" : "absolute"}`} style={{ borderRadius: 999, background: hsl(i.hue, 66, 46), height: P ? 96 : H, ...style }}>
			<span className="font-black uppercase leading-none tracking-tight" style={{ fontSize: P ? 22 : 28 }}>
				{i.name}
			</span>
		</F>
	)
	return (
		<Frame name="Explorer" crumb="Six islands" dest={dest} hue={shown.hue}>
			{P ? (
				<div className="grid grid-cols-2 gap-4">{ISLANDS.map((i, n) => island(i, n))}</div>
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
	return (
		<>
			<div className="absolute inset-0" style={{ background: hsl(title.hue, 58, 24) }} />
			{!P && <Img src={posterOf(title, "w500")} className="absolute inset-y-0 right-0 h-full w-[34%]" />}
			<div className={`absolute top-0 flex items-center justify-between gap-4 ${P ? "inset-x-0 h-[92px] px-6" : "inset-x-0 h-[116px] px-14"}`}>
				<span className={`min-w-0 truncate font-black uppercase tracking-[0.14em] text-white/80 ${P ? "text-[22px]" : "text-[28px]"}`}>{[name, crumb].filter(Boolean).join(" · ")}</span>
				<Expand dest={dest} className={`m-x gap-4 ${P ? "h-[58px] px-5 text-[22px]" : "h-[72px] px-7 text-[28px]"}`} motif={{ w: 60, h: 44, stroke: 5 }} />
			</div>
			<div className={`absolute bottom-0 flex flex-col justify-end ${P ? "inset-x-0 top-[92px] px-6 pb-6" : "left-0 top-[116px] w-[66%] pb-10 pl-14 pr-8"}`}>
				<div className={`font-black uppercase tracking-[0.1em] text-white/80 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className="mt-2 font-black uppercase leading-[0.88] tracking-tight" style={{ fontSize: P ? titleSize(title.title, 50, 36) : titleSize(title.title, 104, 62) }}>
					{title.title}
				</div>
				<div className={`mt-4 flex flex-wrap gap-x-6 font-black uppercase ${P ? "text-[21px]" : "text-[30px]"}`}>
					<span>{title.score} score</span>
					{tv.taste && <span>{title.match}% match</span>}
					<span className="text-white/80">On {title.service}</span>
				</div>
				<div className={`mt-2 font-semibold leading-snug text-white/90 ${P ? "text-[20px]" : "text-[26px]"}`}>{title.line}</div>
				<div className={`flex ${P ? "mt-5 flex-col gap-3" : "mt-7 flex-wrap gap-4"}`}>
					{actions.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`m-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[60px] text-[21px]" : "h-[80px] px-6 text-[25px]"}`}>
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
			<div className="flex h-full flex-col justify-center">
				<div className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 44 : 88 }}>
					Rate 5 titles you've seen.
				</div>
				<div className={`mt-4 font-bold text-white/85 ${P ? "text-[22px]" : "text-[30px]"}`}>{rated} of 5 rated. Then GoodWatch knows your taste.</div>
				<div className="mt-8 flex">
					<F id={start.id} first onOk={start.onOk} className={`m-btn flex items-center px-10 uppercase ${P ? "h-[62px] text-[24px]" : "h-[84px] text-[30px]"}`}>
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
	return (
		<Frame name="Taste" crumb="Three sides of you" dest={dest} hue={shown.hue}>
			<div className={`grid ${P ? "grid-cols-1 gap-4" : "grid-cols-3 gap-6 pt-2"}`}>
				{SIDES.map((s, n) => (
					<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => open(s.key)} className="m-tile flex flex-col justify-end p-5" style={{ height: P ? 120 : 290, background: hsl(s.hue, 62, 44) }}>
						<span className="font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 30 : 50 }}>
							{s.name}
						</span>
						<span className={`mt-2 font-bold leading-tight ${P ? "text-[20px]" : "text-[24px]"}`}>{s.line}</span>
					</F>
				))}
			</div>
			<div className="mt-7 flex">
				<F id={more.id} onOk={more.onOk} className={`m-btn flex items-center px-9 uppercase ${P ? "h-[60px] text-[22px]" : "h-[80px] text-[28px]"}`}>
					{more.label}
				</F>
			</div>
		</Frame>
	)
}

const Ask: Skin["Ask"] = ({ kicker, question, line, answers, title }) => {
	const P = useTv().phone
	return (
		<>
			<Field hue={title?.hue ?? 265} />
			<div className={`absolute inset-0 flex flex-col justify-center ${P ? "px-6" : "px-14"}`}>
				<div className={`font-black uppercase tracking-[0.14em] text-white/80 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className="mt-2 font-black uppercase leading-[0.92] tracking-tight" style={{ fontSize: P ? 40 : titleSize(question, 96, 64) }}>
					{question}
				</div>
				{line && <div className={`mt-3 font-bold text-white/85 ${P ? "text-[21px]" : "text-[30px]"}`}>{line}</div>}
				<div className={`mt-10 ${P ? "flex flex-col gap-3" : "grid gap-5"}`} style={P ? undefined : { gridTemplateColumns: `repeat(${answers.length}, minmax(0, 1fr))` }}>
					{answers.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`m-btn flex items-center justify-center px-4 text-center uppercase leading-tight ${P ? "h-[64px] text-[22px]" : "h-[124px] text-[30px]"}`}>
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
		<div className={`absolute inset-y-0 right-0 flex flex-col justify-center gap-2 bg-white text-black ${P ? "w-[80%] px-5" : "w-[470px] px-8"}`}>
			<div className="mb-3 px-5 text-[22px] font-black uppercase tracking-[0.2em] text-black/55">Menu</div>
			{items.map((item, n) => (
				<F key={item.id} id={item.id} first={n === 0} onOk={item.onOk} className={`m-menu flex items-center px-5 leading-none ${P ? "h-[62px] text-[24px]" : "h-[84px] text-[32px]"}`}>
					{item.label}
				</F>
			))}
		</div>
	)
}

export const marquee: Skin = { css: CSS, Home, Moods, List, Map: IslandMap, TitleView, Taste, Sides, Ask, Menu }
