// PROTOTYPE - throwaway. Direction "Cinema": the art does the work. The whole picture takes the backdrop of
// whatever has the focus and cross-fades as the focus moves; tiles are plain posters and stills without frames;
// the focused one comes forward (larger, lit, a white edge) while the others sit back in the dark. Type is large
// and quiet. Screens arrive with a short zoom out of the picture.
import type { ReactNode } from "react"
import { type Dest, ISLANDS, SIDES, islandTitles } from "~/ui/prototype-tv-flow/data"
import { useTv } from "~/ui/prototype-tv-flow/engine"
import { F, metaOf } from "~/ui/prototype-tv-flow/kit"
import { backdropOf, posterOf } from "./art"
import { Ambient, AppArt, Cross, Expand, Img, type Skin, titleSize, useFocusedTitle } from "./base"

const CSS = `
.tvd-cinema { color: #fff; background: #05060a; }
.tvd-cinema .tvf { border-radius: 14px; transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s, filter .18s, background-color .18s, color .18s; }
.tvd-cinema .c-tile { overflow: hidden; filter: brightness(.62); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.tvd-cinema .c-tile.tvf-on { filter: none; transform: scale(1.09); box-shadow: 0 0 0 4px #fff, 0 26px 60px rgba(0,0,0,.75); z-index: 2; }
.tvd-cinema .c-btn { background: rgba(255,255,255,.16); border-radius: 999px; font-weight: 700; }
.tvd-cinema .c-btn.tvf-on { background: #fff; color: #000; transform: scale(1.06); box-shadow: 0 16px 40px rgba(0,0,0,.55); }
.tvd-cinema .c-x { background: rgba(0,0,0,.5); color: #fbbf24; border-radius: 999px; box-shadow: inset 0 0 0 2px rgba(251,191,36,.6); font-weight: 700; }
.tvd-cinema .c-x.tvf-on { background: #fbbf24; color: #000; transform: scale(1.06); box-shadow: 0 16px 40px rgba(0,0,0,.55); }
.tvd-cinema .tvd-screen { animation: c-in .3s cubic-bezier(.2,.8,.2,1) both; }
@keyframes c-in { from { opacity: 0; transform: scale(1.04); } }
.tvd-cinema .tvd-menu { background: rgba(0,0,0,.6); animation: tvd-fade .2s both; }
.tvd-cinema .tvd-toast { background: #fff; color: #000; border-radius: 999px; padding: 12px 30px; font-size: 26px; font-weight: 700; }
`

/** The picture behind a screen and the shade that keeps type readable on it: dark on the left and at the bottom. */
function Shade({ dim }: { dim: number }) {
	return <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,6,10,.94) 0%, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.45}) 100%), linear-gradient(0deg, rgba(5,6,10,.92) 0%, rgba(5,6,10,0) 50%)` }} />
}

function Frame({ name, crumb, dest, art, dim = 0.6, children }: { name: string; crumb?: string; dest: Dest; art?: string; dim?: number; children: ReactNode }) {
	const P = useTv().phone
	return (
		<>
			{art && <Ambient src={art} />}
			<Shade dim={dim} />
			<div className={`absolute inset-x-0 top-0 flex items-center justify-between gap-4 ${P ? "h-[88px] px-6" : "h-[108px] px-14"}`}>
				<div className="flex min-w-0 items-baseline gap-4">
					<span className={`shrink-0 font-bold ${P ? "text-[30px]" : "text-[36px]"}`}>{name}</span>
					{crumb && <span className={`truncate text-white/70 ${P ? "text-[22px]" : "text-[26px]"}`}>{crumb}</span>}
				</div>
				<Expand dest={dest} className={`c-x gap-4 ${P ? "h-[58px] px-5 text-[22px]" : "h-[64px] px-7 text-[26px]"}`} motif={{ w: 44, h: 32, stroke: 3 }} />
			</div>
			<div className={`absolute inset-x-0 bottom-0 ${P ? "top-[88px] overflow-hidden px-6 pb-6" : "top-[108px] px-14 pb-10"}`}>{children}</div>
		</>
	)
}

const Home: Skin["Home"] = ({ apps, greeting, open }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = apps.find((a) => `app-${a.key}` === tv.focus) ?? apps[0]
	return (
		<>
			<Cross id={shown.key}>
				<AppArt app={shown} size="w1280" className="h-full w-full" />
			</Cross>
			<Shade dim={0.5} />
			<div className={`absolute font-bold uppercase tracking-[0.22em] text-white/80 ${P ? "left-6 top-7 text-[20px]" : "left-14 top-11 text-[22px]"}`}>GoodWatch</div>
			<div className={`absolute ${P ? "inset-x-6 top-[96px]" : "left-14 top-[136px] w-[780px]"}`}>
				<div className={`text-white/75 ${P ? "text-[22px]" : "text-[28px]"}`}>{greeting}.</div>
				<div key={shown.key} className="tvd-fade">
					<div className="font-bold leading-[0.95] tracking-tight" style={{ fontSize: P ? 64 : 108 }}>
						{shown.name}
					</div>
					<div className={`mt-4 leading-snug text-white/85 ${P ? "text-[24px]" : "text-[32px]"}`}>{shown.line}</div>
				</div>
			</div>
			<div className={`absolute inset-x-0 bottom-0 flex overflow-hidden pt-6 ${P ? "gap-4 px-6 pb-8" : "gap-[22px] px-14 pb-12"}`} style={{ scrollPadding: 30 }}>
				{apps.map((a, n) => (
					<F key={a.key} id={`app-${a.key}`} first={n === 0} onOk={() => open(a.key)} className="c-tile shrink-0" style={{ width: 200, height: 128 }}>
						<AppArt app={a} className="absolute inset-0 h-full w-full" />
						<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
						<span className="absolute bottom-3 left-4 text-[26px] font-bold leading-none">{a.name}</span>
					</F>
				))}
			</div>
		</>
	)
}

const Moods: Skin["Moods"] = ({ moods, pick, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = moods.find((m) => `mood-${m.key}` === tv.focus) ?? moods[0]
	return (
		<Frame name="Discover" dest={dest} art={backdropOf(shown.title, "w1280")} dim={0.86}>
			<div className={`font-bold leading-none ${P ? "mb-5 text-[32px]" : "mb-6 text-[46px]"}`}>What kind of night?</div>
			<div className={`grid ${P ? "grid-cols-2 gap-4" : "grid-cols-3 gap-6"}`}>
				{moods.map((m, n) => (
					<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => pick(m.key)} className="c-tile" style={{ height: P ? 140 : 190 }}>
						<Img src={backdropOf(m.title)} className="absolute inset-0 h-full w-full" />
						<span className="absolute inset-0" style={{ background: `linear-gradient(0deg, hsl(${m.hue} 60% 10% / .95) 0%, hsl(${m.hue} 70% 30% / .3) 100%)` }} />
						<span className="absolute inset-x-5 bottom-4">
							<span className={`block font-bold leading-none ${P ? "text-[28px]" : "text-[38px]"}`}>{m.name}</span>
							<span className={`mt-1.5 block leading-tight text-white/85 ${P ? "text-[20px]" : "text-[22px]"}`}>{m.line}</span>
						</span>
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
		<Frame name={name} crumb={crumb} dest={dest} art={x ? backdropOf(x, "w1280") : undefined}>
			<div className="flex h-full flex-col justify-between">
				<div className={P ? "" : "w-[820px]"}>
					{x && (
						<div key={x.key} className="tvd-fade">
							<div className="font-bold leading-none tracking-tight" style={{ fontSize: P ? 34 : titleSize(x.title, 62, 46) }}>
								{x.title}
							</div>
							<div className={`mt-3 text-white/75 ${P ? "text-[20px]" : "text-[26px]"}`}>
								{metaOf(x)} · {x.score} score{tv.taste ? ` · ${x.match}% match` : ""} · On {x.service}
							</div>
							{!P && <div className="mt-2 text-[28px] leading-snug text-white/90">{x.line}</div>}
						</div>
					)}
					{!items.length && <div className="text-[32px] text-white/70">{empty}</div>}
				</div>
				<div className={`flex ${P ? "flex-col gap-2" : "items-end gap-8"}`}>
					<div className="-mx-6 flex min-w-0 flex-1 gap-6 overflow-hidden px-6 py-7" style={{ scrollPadding: 32 }}>
						{items.map((i, n) => (
							<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} label={i.title.title} className="c-tile shrink-0" style={P ? { width: 150, height: 225 } : { width: 172, height: 258 }}>
								<Img src={posterOf(i.title)} className="absolute inset-0 h-full w-full" />
								{i.sub && <span className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2 text-[21px] font-bold leading-tight">{i.sub}</span>}
							</F>
						))}
					</div>
					{actions.length > 0 && (
						<div className={`flex shrink-0 ${P ? "items-center gap-3" : "flex-col gap-3 pb-7"}`}>
							{actionsLabel && <span className="text-[24px] text-white/70">{actionsLabel}</span>}
							{actions.map((a, n) => (
								<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className={`c-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[60px] px-6 text-[22px]" : "h-[68px] px-8 text-[26px]"}`}>
									{a.label}
								</F>
							))}
						</div>
					)}
				</div>
			</div>
		</Frame>
	)
}

/** Where the six islands sit on the sea, in canvas pixels inside the map. */
const AT: Record<string, [number, number]> = { heists: [10, 0], whodunits: [300, 56], "found-family": [600, 0], workplace: [140, 240], "time-loops": [470, 270], space: [900, 110] }
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
	const D = 164
	return (
		<Frame name="Explorer" crumb="Six islands of titles that belong together" dest={dest} art={backdropOf(islandTitles(shown.key)[0], "w1280")} dim={0.88}>
			{P ? (
				<div className="grid grid-cols-2 gap-x-4 gap-y-3">
					{ISLANDS.map((i, n) => (
						<div key={i.key} className="flex flex-col items-center gap-2">
							<F id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} label={i.name} className="c-tile" style={{ width: 118, height: 118, borderRadius: "50%" }}>
								<Img src={backdropOf(islandTitles(i.key)[0])} className="absolute inset-0 h-full w-full" />
							</F>
							<span className="text-[22px] font-bold">{i.name}</span>
						</div>
					))}
				</div>
			) : (
				<div className="relative h-full">
					<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
						{BRIDGES.map(([a, b]) => (
							<line key={a + b} x1={AT[a][0] + D / 2} y1={AT[a][1] + D / 2} x2={AT[b][0] + D / 2} y2={AT[b][1] + D / 2} stroke="rgba(255,255,255,.4)" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" />
						))}
					</svg>
					{ISLANDS.map((i, n) => (
						<div key={i.key}>
							<F id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} label={i.name} className="c-tile absolute" style={{ left: AT[i.key][0], top: AT[i.key][1], width: D, height: D, borderRadius: "50%" }}>
								<Img src={backdropOf(islandTitles(i.key)[0])} className="absolute inset-0 h-full w-full" />
							</F>
							<span className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full px-4 text-[28px] font-bold transition-colors ${shown.key === i.key ? "bg-white text-black" : "bg-black/60 text-white/80"}`} style={{ left: AT[i.key][0] + D / 2, top: AT[i.key][1] + D + 16 }}>
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
		<Frame name={name} crumb={crumb} dest={dest} art={backdropOf(title, "w1280")} dim={0.45}>
			<div className="flex h-full flex-col justify-end">
				<div className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className="mt-2 font-bold leading-[0.95] tracking-tight" style={{ fontSize: P ? titleSize(title.title, 52, 38) : titleSize(title.title, 96, 66) }}>
					{title.title}
				</div>
				<div className={`mt-5 flex flex-wrap items-center gap-x-7 ${P ? "text-[22px]" : "text-[30px]"}`}>
					<span>
						<b>{title.score}</b> <span className="text-white/65">score</span>
					</span>
					{tv.taste && (
						<span>
							<b>{title.match}%</b> <span className="text-white/65">match</span>
						</span>
					)}
					<span className="text-white/80">On {title.service}</span>
				</div>
				<div className={`mt-3 max-w-[760px] leading-snug text-white/90 ${P ? "text-[21px]" : "text-[28px]"}`}>{title.line}</div>
				<div className={`flex ${P ? "mt-5 flex-col gap-3" : "mt-8 gap-4"}`}>
					{actions.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`c-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[60px] text-[22px]" : "h-[74px] px-9 text-[28px]"}`}>
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
		<Frame name="Taste" dest={dest} art={backdropOf("arrival", "w1280")} dim={0.8}>
			<div className="flex h-full flex-col justify-center">
				<div className="font-bold leading-[1.02] tracking-tight" style={{ fontSize: P ? 40 : 72 }}>
					Rate 5 titles you've seen.
				</div>
				<div className={`mt-3 text-white/80 ${P ? "text-[22px]" : "text-[30px]"}`}>{rated} of 5 rated. Then GoodWatch knows your taste.</div>
				<div className="mt-9 flex">
					<F id={start.id} first onOk={start.onOk} className={`c-btn flex items-center px-10 ${P ? "h-[62px] text-[24px]" : "h-[76px] text-[30px]"}`}>
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
		<Frame name="Taste" crumb="Three sides of you" dest={dest} art={backdropOf(shown.titles[0], "w1280")} dim={0.86}>
			<div className={`grid ${P ? "grid-cols-1 gap-4" : "grid-cols-3 gap-6 pt-2"}`}>
				{SIDES.map((s, n) => (
					<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => open(s.key)} className="c-tile" style={{ height: P ? 120 : 270 }}>
						<Img src={backdropOf(s.titles[0])} className="absolute inset-0 h-full w-full" />
						<span className="absolute inset-0" style={{ background: `linear-gradient(0deg, hsl(${s.hue} 60% 10% / .95) 0%, hsl(${s.hue} 70% 30% / .25) 100%)` }} />
						<span className="absolute inset-x-5 bottom-5">
							<span className={`block font-bold leading-none ${P ? "text-[28px]" : "text-[38px]"}`}>{s.name}</span>
							<span className={`mt-2 block leading-tight text-white/85 ${P ? "text-[20px]" : "text-[23px]"}`}>{s.line}</span>
						</span>
					</F>
				))}
			</div>
			<div className="mt-8 flex">
				<F id={more.id} onOk={more.onOk} className={`c-btn flex items-center px-9 ${P ? "h-[60px] text-[22px]" : "h-[70px] text-[27px]"}`}>
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
			{title && <Ambient src={backdropOf(title, "w1280")} />}
			<Shade dim={0.82} />
			<div className={`absolute inset-0 flex flex-col justify-center ${P ? "px-6" : "px-14"}`}>
				<div className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className="mt-2 font-bold leading-[1.02] tracking-tight" style={{ fontSize: P ? 38 : titleSize(question, 80, 60) }}>
					{question}
				</div>
				{line && <div className={`mt-3 text-white/80 ${P ? "text-[21px]" : "text-[30px]"}`}>{line}</div>}
				<div className={`mt-10 ${P ? "flex flex-col gap-3" : "grid gap-5"}`} style={P ? undefined : { gridTemplateColumns: `repeat(${answers.length}, minmax(0, 1fr))` }}>
					{answers.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`c-btn flex items-center justify-center px-4 text-center leading-tight ${P ? "h-[64px] text-[24px]" : "h-[116px] text-[32px]"}`} style={P ? undefined : { borderRadius: 26 }}>
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
		<div className={`absolute inset-y-0 right-0 flex flex-col justify-center gap-4 bg-[#0b0c11]/95 ${P ? "w-[80%] px-6" : "w-[440px] px-10"}`}>
			<div className="mb-2 text-[22px] font-bold uppercase tracking-[0.2em] text-white/60">Menu</div>
			{items.map((item, n) => (
				<F key={item.id} id={item.id} first={n === 0} onOk={item.onOk} className={`c-btn flex items-center px-9 ${P ? "h-[62px] text-[24px]" : "h-[76px] text-[30px]"}`}>
					{item.label}
				</F>
			))}
		</div>
	)
}

export const cinema: Skin = { css: CSS, Home, Moods, List, Map: IslandMap, TitleView, Taste, Sides, Ask, Menu }
