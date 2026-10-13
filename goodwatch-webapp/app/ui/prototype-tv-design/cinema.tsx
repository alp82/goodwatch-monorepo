// PROTOTYPE - throwaway. Direction "Cinema": the art does the work. The whole picture takes the backdrop of
// whatever has the focus and cross-fades as the focus moves; tiles are plain posters and stills without frames;
// the focused one comes forward (larger, lit, a white edge) while the others sit back in the dark. Type is large
// and quiet. Screens arrive with a short zoom out of the picture.
import type { ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import { type Dest, ISLANDS, SIDES, islandTitles } from "~/ui/prototype-tv-flow/data"
import { useTv } from "~/ui/prototype-tv-flow/engine"
import { F, metaOf } from "~/ui/prototype-tv-flow/kit"
import { RATING_LEVELS, levelOf } from "~/ui/taste-quiz/quiz-flow"
import { assetUrl } from "~/utils/asset-url"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { backdropOf, posterOf } from "./art"
import { SERVICES, type ServiceKey } from "./choices"
import { Actions, Ambient, AppArt, BarTitle, Corner, Cross, Img, type Skin, titleSize, useExpandAt, useFocusedTitle } from "./base"

const CSS = `
.tvd-cinema { color: #fff; background: #05060a; }
.tvd-cinema .tvf { border-radius: 14px; transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s, filter .18s, background-color .18s, color .18s; }
.tvd-cinema .c-tile { overflow: hidden; filter: brightness(.62); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.tvd-cinema .c-tile.tvf-on { filter: none; transform: scale(1.09); box-shadow: 0 0 0 4px #fff, 0 26px 60px rgba(0,0,0,.75); z-index: 2; }
.tvd-cinema .c-btn { background: rgba(255,255,255,.16); border-radius: 999px; font-weight: 700; }
.tvd-cinema .c-btn.tvf-on { background: #fff; color: #000; transform: scale(1.06); box-shadow: 0 16px 40px rgba(0,0,0,.55); }
.tvd-cinema .c-act { background: rgba(0,0,0,.4); color: rgba(255,255,255,.88); border-radius: 999px; font-weight: 700; }
.tvd-cinema .c-act.tvf-on { background: #fff; color: #000; transform: scale(1.06); box-shadow: 0 16px 40px rgba(0,0,0,.55); }
.tvd-cinema .c-x { background: rgba(0,0,0,.5); color: #fbbf24; border-radius: 999px; box-shadow: inset 0 0 0 2px rgba(251,191,36,.6); font-weight: 700; }
.tvd-cinema .c-x.tvf-on { background: #fbbf24; color: #000; transform: scale(1.06); box-shadow: 0 16px 40px rgba(0,0,0,.55); }
.tvd-cinema .c-tab { color: rgba(255,255,255,.72); border-radius: 999px; font-weight: 700; }
.tvd-cinema .c-tab.c-tab-on { background: rgba(255,255,255,.2); color: #fff; box-shadow: inset 0 -4px 0 #fff; }
.tvd-cinema .c-tab.tvf-on { background: #fff; color: #000; transform: scale(1.05); box-shadow: 0 14px 34px rgba(0,0,0,.55); }
.tvd-cinema .c-lvl { background: rgba(255,255,255,.12); border-radius: 18px; font-weight: 800; }
.tvd-cinema .c-lvl.tvf-on { background: rgba(255,255,255,.24); transform: scale(1.04); box-shadow: 0 0 0 4px #fff, 0 18px 40px rgba(0,0,0,.6); z-index: 2; }
.tvd-cinema .c-num { border-radius: 12px; font-weight: 900; font-variant-numeric: tabular-nums; }
.tvd-cinema .c-num.tvf-on { color: #0b0c10; transform: scale(1.12); box-shadow: 0 0 0 4px #fff, 0 16px 36px rgba(0,0,0,.6); z-index: 2; }
.tvd-cinema .tvd-screen { animation: c-in .3s cubic-bezier(.2,.8,.2,1) both; }
@keyframes c-in { from { opacity: 0; transform: scale(1.04); } }
.tvd-cinema .tvd-menu { background: rgba(0,0,0,.6); animation: tvd-fade .2s both; }
.tvd-cinema .tvd-toast { background: #fff; color: #000; border-radius: 999px; padding: 12px 30px; font-size: 26px; font-weight: 700; }
`

/** The picture behind a screen and the shade that keeps type readable on it: dark on the left and at the bottom. */
function Shade({ dim }: { dim: number }) {
	return <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,6,10,.94) 0%, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.45}) 100%), linear-gradient(0deg, rgba(5,6,10,.92) 0%, rgba(5,6,10,0) 50%)` }} />
}

const X = { phone: "c-x h-[54px] gap-2.5 px-3.5 text-[20px]", desk: "c-x h-[64px] gap-4 px-6 text-[26px]" }
const MOTIF = { w: 44, h: 32, stroke: 3 }

/** The actions as this direction draws them: quiet dark pills, and the expand key in amber. */
function Bar({ dest, className }: { dest?: Dest; className?: string }) {
	const P = useTv().phone
	return <Actions dest={dest} className={className} cls={P ? "c-act h-[54px] w-[54px]" : "c-act h-[64px] gap-2.5 px-5 text-[24px]"} xcls={P ? X.phone : X.desk} motif={MOTIF} />
}

/**
 * A screen with the top bar. With the expand key at the bottom right, the key sits in the picture's corner;
 * `reserve` keeps the whole band under the content free for it on the desktop, where a screen fills its width.
 * On the phone every screen leaves the corner free itself.
 */
function Frame({ name, crumb, dest, art, dim = 0.6, reserve, mark, children }: { name: string; crumb?: string; dest: Dest; art?: string; dim?: number; reserve?: boolean; mark?: ReactNode; children: ReactNode }) {
	const P = useTv().phone
	const B = useExpandAt() === "bottom"
	return (
		<>
			{art && <Ambient src={art} />}
			<Shade dim={dim} />
			<div className={`absolute inset-x-0 top-0 flex gap-4 ${P ? "h-[78px] items-center justify-between px-5" : "h-[108px] items-center justify-between px-14"}`}>
				{/* A service's screen leads with the service's own mark. */}
				{mark}
				<BarTitle name={name} crumb={crumb} nameClass={`font-bold ${P ? "text-[24px]" : "text-[36px]"}`} crumbClass={`text-white/70 ${P ? "text-[20px]" : "text-[24px]"}`} />
				<Bar dest={dest} />
			</div>
			<div className={`absolute inset-x-0 bottom-0 ${P ? "top-[78px] overflow-hidden px-5 pb-5" : `top-[108px] px-14 ${B && reserve ? "pb-[120px]" : "pb-10"}`}`}>{children}</div>
			<Corner dest={dest} className={P ? X.phone : X.desk} motif={MOTIF} at={P ? "bottom-5 right-5" : "bottom-10 right-14"} />
		</>
	)
}

/** The phone's last row: what a screen puts beside the expand key, which has the right end of it. */
function Foot({ children }: { children?: ReactNode }) {
	return <div className="mt-2.5 flex h-[54px] shrink-0 items-center gap-2 pr-[158px]">{children}</div>
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
			<div className={`absolute font-bold uppercase tracking-[0.22em] text-white/80 ${P ? "left-5 top-[28px] text-[20px]" : "left-14 top-11 text-[22px]"}`}>GoodWatch</div>
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`absolute ${P ? "inset-x-5 top-[82px]" : "left-14 top-[136px] w-[780px]"}`}>
				<div className={`text-white/75 ${P ? "text-[20px]" : "text-[28px]"}`}>{greeting}.</div>
				<div key={shown.key} className="tvd-fade">
					<div className="font-bold leading-[0.95] tracking-tight" style={{ fontSize: P ? 56 : 108 }}>
						{shown.name}
					</div>
					<div className={`leading-snug text-white/85 ${P ? "mt-2 text-[21px]" : "mt-4 text-[32px]"}`}>{shown.line}</div>
				</div>
			</div>
			<div className={`absolute inset-x-0 bottom-0 flex overflow-hidden ${P ? "gap-3.5 px-5 pb-5 pt-4" : "gap-[22px] px-14 pb-12 pt-6"}`} style={{ scrollPadding: 30 }}>
				{apps.map((a, n) => (
					<F key={a.key} id={`app-${a.key}`} first={n === 0} onOk={() => open(a.key)} className="c-tile shrink-0" style={P ? { width: 172, height: 110 } : { width: 200, height: 128 }}>
						<AppArt app={a} className="absolute inset-0 h-full w-full" />
						<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
						{a.service ? (
							<span className="absolute bottom-3 left-4">
								<Mark service={a.service} height={P ? 24 : 28} />
							</span>
						) : (
							<span className={`absolute bottom-3 left-4 font-bold leading-none ${P ? "text-[23px]" : "text-[26px]"}`}>{a.name}</span>
						)}
					</F>
				))}
			</div>
		</>
	)
}

const MARK: Record<ServiceKey, { src: string; ratio: number }> = { netflix: { src: netflixMark, ratio: 3.7 }, prime: { src: primeMark, ratio: 3.25 } }

/** A streaming service's own mark, in its own colour. */
function Mark({ service, height }: { service: ServiceKey; height: number }) {
	const mask = `url("${assetUrl(MARK[service].src)}") center / contain no-repeat`
	return <span aria-hidden className="block shrink-0" style={{ height, width: height * MARK[service].ratio, background: SERVICES[service].ink, WebkitMask: mask, mask }} />
}

/** An option's tile on mini Discover's first screen: its picture under its own colour, its name on it. */
const tint = (color: string) => `linear-gradient(0deg, color-mix(in srgb, ${color} 26%, #05060a) 0%, color-mix(in srgb, ${color} 34%, transparent) 100%)`

/**
 * Mini Discover's first screen with the app's real names. Either six moods and Any mood beside them, or three tabs
 * (Moods, Themes, Styles) of six options each. A tab opens when the direction keys land on it, so Left and Right
 * along the tabs turn the pages; the pointer and a finger open it with a click or a tap. Up from the tiles lands on
 * the open tab, and Up again reaches the top bar.
 */
const Choice: NonNullable<Skin["Choice"]> = ({ tabs, tab, setTab, options, any, pick, dest }) => {
	const tv = useTv()
	const P = tv.phone
	const shown = options.find((o) => o.item === tv.focus) ?? (any && any.item === tv.focus ? any : options[0])
	const tile = (o: (typeof options)[number], n: number) => (
		<F key={o.item} id={o.item} first={n === 0} onOk={() => pick(o)} className="c-tile" style={P ? undefined : { height: 158 }}>
			<Img src={backdropOf(o.art)} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0" style={{ background: tint(o.color) }} />
			<span className={`absolute ${P ? "inset-x-3 bottom-2.5" : "inset-x-5 bottom-4"}`}>
				<span className={`block font-bold leading-none ${P ? "text-[22px]" : "text-[38px]"}`}>{o.name}</span>
				{!P && <span className="mt-1.5 line-clamp-2 text-[22px] leading-tight text-white/85">{o.line}</span>}
			</span>
		</F>
	)
	const row = tabs && (
		// A group: coming from the tiles, the focus lands on the tab that is open.
		<div data-tv-group data-tv-prefer={`tab-${tab}`} role="tablist" className={`flex shrink-0 ${P ? "h-[52px] gap-2" : "mb-5 h-[64px] gap-3"}`}>
			{tabs.map((t) => (
				<F key={t.key} id={`tab-${t.key}`} onOk={() => setTab(t.key)} onKeyFocus={() => setTab(t.key)} label={t.name} className={`c-tab tvx flex items-center justify-center ${t.key === tab ? "c-tab-on" : ""} ${P ? "flex-1 text-[22px]" : "px-9 text-[28px]"}`}>
					{t.name}
				</F>
			))}
		</div>
	)
	const anyKey = any && (
		<F id={any.item} onOk={() => pick(any)} className={`c-btn flex shrink-0 items-center whitespace-nowrap ${P ? "h-[54px] px-5 text-[21px]" : "h-[64px] px-8 text-[26px]"}`}>
			{any.name}
		</F>
	)
	const art = backdropOf(shown.art, "w1280")
	// The phone: six options three by three, and beside the expand key Any mood or the focused option's line.
	if (P)
		return (
			<Frame name="Discover" crumb={tabs ? undefined : "What kind of night?"} dest={dest} art={art} dim={0.86}>
				<div className="flex h-full flex-col">
					{row}
					<div key={tab} className={`grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3 ${tabs ? "pt-2.5" : "pt-1"}`}>{options.map(tile)}</div>
					<Foot>
						{anyKey}
						<span key={shown.item} className="tvd-fade line-clamp-2 min-w-0 text-[20px] leading-tight text-white/85">
							{shown.line}
						</span>
					</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame name="Discover" dest={dest} art={art} dim={0.86} reserve>
			{row ?? <div className="mb-6 text-[46px] font-bold leading-none">What kind of night?</div>}
			<div key={tab} className="grid grid-cols-3 gap-6">
				{options.map(tile)}
			</div>
			{/* Any mood stands in the band the expand key has, at its other end. */}
			{anyKey && <div className="mt-6 flex">{anyKey}</div>}
		</Frame>
	)
}

/**
 * A score for a title, on the app's rating strip (ui/title-actions/ScoreControl.tsx): the four named levels, each
 * as wide as its scores, low on the left; under them the ten exact scores. OK on a level gives the level's score
 * (3, 5, 7, 9), as in the app; Down from a level goes to the exact scores under it. The level the focus is in
 * lights its scores. On the phone the levels are four equal keys and the scores stand in two rows of five, so
 * every key is 44 px or more.
 */
const Rate: NonNullable<Skin["Rate"]> = ({ kicker, question, line, title, onScore, skip }) => {
	const tv = useTv()
	const P = tv.phone
	const focus = tv.focus ?? ""
	const at = focus.startsWith("level-") ? RATING_LEVELS.findIndex((l) => `level-${l.name.toLowerCase()}` === focus) : focus.startsWith("score-") ? levelOf(Number(focus.slice(6))) : -1
	const exact = focus.startsWith("score-") ? Number(focus.slice(6)) : null
	// What the focus would give, in words: the app's own label for an exact score, the level's score for a level.
	const says = exact ? `${exact} · ${scoreLabels[exact]}` : at >= 0 ? `${RATING_LEVELS[at].name} · OK gives it ${RATING_LEVELS[at].score}` : line
	// The phone has one line for it, where the kicker stands until the focus is on the strip.
	const short = exact ? `${exact} · ${scoreLabels[exact]}` : at >= 0 ? `${RATING_LEVELS[at].name} · gives ${RATING_LEVELS[at].score}` : kicker
	const levels = RATING_LEVELS.map((l) => (
		<F key={l.name} id={`level-${l.name.toLowerCase()}`} first={l.name === "Good"} onOk={() => onScore(l.score)} label={`${l.name}, ${l.score}`} className={`c-lvl flex items-center ${P ? "h-[68px] flex-col justify-center gap-1 px-1" : "h-[92px] gap-4 px-5"}`} style={P ? undefined : { gridColumn: `span ${l.hi - l.lo + 1}` }}>
			<span className={`shrink-0 rounded-full ${P ? "h-1.5 w-10" : "h-10 w-2"}`} style={{ background: getVibeColorValue(l.score) }} />
			{P ? (
				<span className="text-[20px] leading-none">{l.name}</span>
			) : (
				// The name over its scores, as the app's strip shows them at its roomy size.
				<span className="flex min-w-0 flex-col gap-1.5 leading-none">
					<span className="text-[28px]">{l.name}</span>
					<span className="whitespace-nowrap text-[21px] font-semibold tabular-nums text-white/55">
						{l.lo}–{l.hi}
					</span>
				</span>
			)}
		</F>
	))
	const scores = Array.from({ length: 10 }, (_, i) => (i + 1) as Score).map((score) => {
		const lit = at >= 0 && levelOf(score) === at
		const on = exact === score
		return (
			<F key={score} id={`score-${score}`} onOk={() => onScore(score)} label={`${score}, ${scoreLabels[score]}`} className={`c-num flex items-center justify-center ${P ? "h-[68px] text-[26px]" : "h-[64px] text-[30px]"} ${lit || at < 0 ? "text-white" : "text-white/60"}`} style={{ background: `${getVibeColorValue(score)}${on ? "" : lit ? "88" : at < 0 ? "55" : "30"}` }}>
				{score}
			</F>
		)
	})
	// The ten scores are one group: coming down from a level, the focus lands on that level's lowest score.
	const under = { "data-tv-group": true, "data-tv-prefer": at >= 0 ? `score-${RATING_LEVELS[at].lo}` : undefined }
	const pass = skip && (
		<F id={skip.id} onOk={skip.onOk} className={`c-btn flex shrink-0 items-center whitespace-nowrap ${P ? "h-[68px] px-4 text-[20px]" : "h-[64px] px-8 text-[26px]"}`}>
			{skip.label}
		</F>
	)
	return (
		<>
			<Ambient src={backdropOf(title, "w1280")} />
			<Shade dim={0.82} />
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			{P ? (
				<div className="absolute inset-x-0 bottom-0 top-[74px] flex flex-col justify-end gap-1.5 px-5 pb-3">
					<div className="flex min-h-0 flex-1 items-center gap-3">
						<div className="min-w-0 flex-1">
							<div className="truncate text-[20px] font-bold uppercase leading-tight tracking-[0.12em] text-white/75">{short}</div>
							<div className="truncate text-[26px] font-bold leading-tight tracking-tight">{question}</div>
						</div>
						{pass}
					</div>
					<div className="grid shrink-0 grid-cols-4 gap-1.5">{levels}</div>
					<div {...under} className="grid shrink-0 grid-cols-5 gap-1.5">
						{scores}
					</div>
				</div>
			) : (
				<div className="absolute inset-0 flex flex-col justify-center px-14 pt-16">
					<div className="text-[24px] font-bold uppercase tracking-[0.16em] text-white/75">{kicker}</div>
					<div className="mt-2 font-bold leading-[1.02] tracking-tight" style={{ fontSize: titleSize(question, 72, 54) }}>
						{question}
					</div>
					<div className="mt-3 h-[40px] text-[30px] text-white/85">{says}</div>
					<fieldset aria-label="Your score" className="mt-7 grid grid-cols-10 gap-2">
						{levels}
						<div {...under} className="col-span-10 grid grid-cols-10 gap-2">
							{scores}
						</div>
					</fieldset>
					{pass && <div className="mt-7 flex">{pass}</div>}
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
	const tile = (m: (typeof moods)[number], n: number) => (
		<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => pick(m.key)} className="c-tile" style={P ? undefined : { height: B ? 158 : 190 }}>
			<Img src={backdropOf(m.title)} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0" style={{ background: `linear-gradient(0deg, hsl(${m.hue} 60% 10% / .95) 0%, hsl(${m.hue} 70% 30% / .3) 100%)` }} />
			<span className={`absolute ${P ? "inset-x-3 bottom-2.5" : "inset-x-5 bottom-4"}`}>
				<span className={`block font-bold leading-none ${P ? "text-[22px]" : "text-[38px]"}`}>{m.name}</span>
				{!P && <span className="mt-1.5 block text-[22px] leading-tight text-white/85">{m.line}</span>}
			</span>
		</F>
	)
	// The phone: six moods three by three, and the focused one's line beside the expand key.
	if (P)
		return (
			<Frame name="Discover" crumb="What kind of night?" dest={dest} art={backdropOf(shown.title, "w1280")} dim={0.86}>
				<div className="flex h-full flex-col">
					<div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3 pt-1">{moods.map(tile)}</div>
					<Foot>
						<span key={shown.key} className="tvd-fade text-[20px] leading-tight text-white/85">
							{shown.line}
						</span>
					</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame name="Discover" dest={dest} art={backdropOf(shown.title, "w1280")} dim={0.86} reserve>
			<div className="mb-6 text-[46px] font-bold leading-none">What kind of night?</div>
			<div className="grid grid-cols-3 gap-6">{moods.map(tile)}</div>
		</Frame>
	)
}

type ListProps = Parameters<Skin["List"]>[0]

const List: Skin["List"] = (p) => <ListView {...p} />

/**
 * What to watch on one streaming service: the list of titles as everywhere, under the service's own mark, with a
 * line of its colour under the top bar and nothing else of it. The expand key leads to the real Discover with
 * that service alone.
 */
const Service: NonNullable<Skin["Service"]> = ({ service, items, dest }) => {
	// On the phone the mark says the name: beside it there is room for the count only.
	const P = useTv().phone
	return <ListView name={P ? `${items.length} to watch` : `On ${service.name}`} crumb={P ? undefined : `${items.length} titles, best match first`} dest={dest} items={items} actions={[]} brand={service.key} />
}

function ListView({ name, crumb, dest, items, actions, actionsLabel, empty, brand }: ListProps & { brand?: ServiceKey }) {
	const tv = useTv()
	const P = tv.phone
	const B = useExpandAt() === "bottom"
	const x = useFocusedTitle(items)
	const mark = brand && (
		<>
			<div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: SERVICES[brand].accent }} />
			<span className={`flex shrink-0 items-center rounded-[10px] bg-black/55 ${P ? "h-[46px] px-3" : "h-[64px] px-5"}`}>
				<Mark service={brand} height={P ? 20 : 28} />
			</span>
		</>
	)
	const facts = x && `${metaOf(x)} · ${x.score} score${tv.taste ? ` · ${x.match}% match` : ""} · On ${x.service}`
	// The phone: one line of name, one of facts, the posters as tall as is left, and the actions beside the expand key.
	if (P) {
		const sub = items.find((i) => i.title === x)?.sub
		return (
			<Frame name={name} crumb={crumb} dest={dest} art={x ? backdropOf(x, "w1280") : undefined} mark={mark}>
				<div className="flex h-full flex-col">
					{x && (
						<div key={x.key} className="tvd-fade shrink-0">
							<div className="truncate text-[30px] font-bold leading-none tracking-tight">{x.title}</div>
							<div className="mt-2 truncate text-[20px] leading-tight text-white/75">{sub ? `${sub} · ${x.score} score · On ${x.service}` : facts}</div>
						</div>
					)}
					{!items.length && <div className="text-[26px] text-white/70">{empty}</div>}
					<div className="-mx-5 flex min-h-0 flex-1 gap-3.5 overflow-hidden px-5 py-3.5" style={{ scrollPadding: 24 }}>
						{items.map((i, n) => (
							<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} label={i.title.title} className="c-tile aspect-[2/3] h-full shrink-0">
								<Img src={posterOf(i.title)} className="absolute inset-0 h-full w-full" />
							</F>
						))}
					</div>
					<Foot>
						{actions.slice(0, 2).map((a, n) => (
							<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="c-btn flex h-[54px] min-w-0 items-center px-5 text-[21px]">
								<span className="truncate">{a.label}</span>
							</F>
						))}
					</Foot>
				</div>
			</Frame>
		)
	}
	return (
		<Frame name={name} crumb={crumb} dest={dest} art={x ? backdropOf(x, "w1280") : undefined} reserve mark={mark}>
			<div className="flex min-h-full flex-col justify-between">
				<div className="w-[820px]">
					{x && (
						<div key={x.key} className="tvd-fade">
							<div className="font-bold leading-none tracking-tight" style={{ fontSize: titleSize(x.title, 62, 46) }}>
								{x.title}
							</div>
							<div className="mt-3 text-[26px] text-white/75">{facts}</div>
							{/* With the expand key under the posters there is no room for the line. */}
							{!B && <div className="mt-2 text-[28px] leading-snug text-white/90">{x.line}</div>}
						</div>
					)}
					{!items.length && <div className="text-[32px] text-white/70">{empty}</div>}
				</div>
				<div className="flex items-end gap-8">
					<div className="-mx-6 flex min-w-0 flex-1 gap-6 overflow-hidden px-6 py-7" style={{ scrollPadding: 32 }}>
						{items.map((i, n) => (
							<F key={i.id} id={i.id} first={n === 0} onOk={i.onOk} label={i.title.title} className="c-tile shrink-0" style={{ width: 172, height: 258 }}>
								<Img src={posterOf(i.title)} className="absolute inset-0 h-full w-full" />
								{i.sub && <span className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2 text-[21px] font-bold leading-tight">{i.sub}</span>}
							</F>
						))}
					</div>
					{actions.length > 0 && (
						<div className="flex shrink-0 flex-col gap-3 pb-7">
							{actionsLabel && <span className="text-[24px] text-white/70">{actionsLabel}</span>}
							{actions.map((a, n) => (
								<F key={a.id} id={a.id} first={!items.length && n === 0} onOk={a.onOk} className="c-btn flex h-[68px] items-center justify-center whitespace-nowrap px-8 text-[26px]">
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
		<Frame name="Explorer" crumb="Six islands" dest={dest} art={backdropOf(islandTitles(shown.key)[0], "w1280")} dim={0.88}>
			{P ? (
				// The phone: the six islands three by three; the corner under them is the expand key's.
				<div className="grid grid-cols-3 gap-x-2 gap-y-1 pt-1">
					{ISLANDS.map((i, n) => (
						<div key={i.key} className="flex flex-col items-center gap-1">
							<F id={`island-${i.key}`} first={n === 0} onOk={() => open(i.key)} label={i.name} className="c-tile h-[84px] w-[84px] [.tvd-short_&]:h-[72px] [.tvd-short_&]:w-[72px]" style={{ borderRadius: "50%" }}>
								<Img src={backdropOf(islandTitles(i.key)[0])} className="absolute inset-0 h-full w-full" />
							</F>
							<span className="whitespace-nowrap text-[20px] font-bold leading-tight">{i.name}</span>
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
			<div className="flex min-h-full flex-col justify-end">
				{!P && <div className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>}
				<div className="mt-2 font-bold leading-[0.95] tracking-tight" style={{ fontSize: P ? titleSize(title.title, 44, 32) : titleSize(title.title, 96, 66) }}>
					{title.title}
				</div>
				<div className={`flex flex-wrap items-center ${P ? "mt-2.5 gap-x-5 text-[21px]" : "mt-5 gap-x-7 text-[30px]"}`}>
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
				{!P && <div className={`mt-3 max-w-[760px] leading-snug text-white/90 ${P ? "text-[21px]" : "text-[28px]"}`}>{title.line}</div>}
				{/* The phone: the actions in a column on the left; the corner beside the last one is the expand key's. */}
				<div className={`flex ${P ? "mt-3.5 w-[292px] flex-col gap-2" : "mt-8 gap-4"}`}>
					{actions.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`c-btn flex items-center justify-center whitespace-nowrap ${P ? "h-[52px] shrink-0 text-[21px] [.tvd-short_&]:h-[46px]" : "h-[74px] px-9 text-[28px]"}`}>
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
			<div className="flex min-h-full flex-col justify-center">
				<div className="font-bold leading-[1.02] tracking-tight" style={{ fontSize: P ? 36 : 72 }}>
					Rate 5 titles you've seen.
				</div>
				<div className={`text-white/80 ${P ? "mt-2 text-[21px]" : "mt-3 text-[30px]"}`}>{rated} of 5 rated. Then GoodWatch knows your taste.</div>
				<div className={`flex ${P ? "mt-6" : "mt-9"}`}>
					<F id={start.id} first onOk={start.onOk} className={`c-btn flex items-center ${P ? "h-[54px] px-7 text-[22px]" : "h-[76px] px-10 text-[30px]"}`}>
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
	const tile = (s: (typeof SIDES)[number], n: number) => (
		<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => open(s.key)} className="c-tile" style={P ? undefined : { height: 270 }}>
			<Img src={backdropOf(s.titles[0])} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0" style={{ background: `linear-gradient(0deg, hsl(${s.hue} 60% 10% / .95) 0%, hsl(${s.hue} 70% 30% / .25) 100%)` }} />
			<span className={`absolute ${P ? "inset-x-3 bottom-3" : "inset-x-5 bottom-5"}`}>
				<span className={`block font-bold leading-none ${P ? "text-[22px]" : "text-[38px]"}`}>{s.name}</span>
				{!P && <span className="mt-2 block text-[23px] leading-tight text-white/85">{s.line}</span>}
			</span>
		</F>
	)
	const again = (
		<F id={more.id} onOk={more.onOk} className={`c-btn flex items-center ${P ? "h-[54px] px-6 text-[21px]" : "h-[70px] px-9 text-[27px]"}`}>
			{more.label}
		</F>
	)
	// The phone: the three sides side by side, the focused one's line over them, the action beside the expand key.
	if (P)
		return (
			<Frame name="Taste" crumb="Three sides of you" dest={dest} art={backdropOf(shown.titles[0], "w1280")} dim={0.86}>
				<div className="flex h-full flex-col">
					<div key={shown.key} className="tvd-fade shrink-0 truncate text-[20px] leading-tight text-white/85">
						{shown.line}
					</div>
					<div className="mt-2.5 grid min-h-0 flex-1 grid-cols-3 gap-3">{SIDES.map(tile)}</div>
					<Foot>{again}</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame name="Taste" crumb="Three sides of you" dest={dest} art={backdropOf(shown.titles[0], "w1280")} dim={0.86}>
			<div className="grid grid-cols-3 gap-6 pt-2">{SIDES.map(tile)}</div>
			<div className="mt-8 flex">{again}</div>
		</Frame>
	)
}

const Ask: Skin["Ask"] = ({ kicker, question, line, answers, title }) => {
	const P = useTv().phone
	return (
		<>
			{title && <Ambient src={backdropOf(title, "w1280")} />}
			<Shade dim={0.82} />
			<Bar className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`} />
			<div className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[70px]" : "px-14 pt-16"}`}>
				<div className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}>{kicker}</div>
				<div className={`font-bold leading-[1.02] tracking-tight ${P ? "mt-1" : "mt-2"}`} style={{ fontSize: P ? 32 : titleSize(question, 80, 60) }}>
					{question}
				</div>
				{line && <div className={`text-white/80 ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}>{line}</div>}
				<div className={`grid ${P ? "mt-4 gap-2.5" : "mt-10 gap-5"}`} style={{ gridTemplateColumns: `repeat(${P ? 2 : answers.length}, minmax(0, 1fr))` }}>
					{answers.map((a, n) => (
						<F key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className={`c-btn flex items-center justify-center px-4 text-center leading-tight ${P ? "h-[52px] text-[22px] [.tvd-short_&]:h-[46px]" : "h-[116px] text-[32px]"}`} style={P ? undefined : { borderRadius: 26 }}>
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
		<div className={`absolute inset-y-0 right-0 flex flex-col justify-center gap-4 bg-[#0b0c11]/95 ${P ? "w-[78%] !gap-2 px-5" : "w-[440px] px-10"}`}>
			<div className={`font-bold uppercase tracking-[0.2em] text-white/60 ${P ? "text-[20px]" : "mb-2 text-[22px]"}`}>Menu</div>
			{items.map((item, n) => (
				<F key={item.id} id={item.id} first={n === 0} onOk={item.onOk} className={`c-btn flex shrink-0 items-center px-9 ${P ? "h-[48px] !px-6 text-[21px]" : "h-[76px] text-[30px]"}`}>
					{item.label}
				</F>
			))}
		</div>
	)
}

export const cinema: Skin = { css: CSS, Home, Moods, List, Map: IslandMap, TitleView, Taste, Sides, Ask, Menu, Choice, Rate, Service }
