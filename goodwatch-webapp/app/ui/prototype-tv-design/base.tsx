// PROTOTYPE - throwaway. What the three visual directions share: the apps flow itself (which screen shows what,
// with the same item ids as the flow prototype), the art of the five apps, and the follower that glides to the
// focused item. How anything looks is the direction's business (a `Skin`): cinema.tsx, marquee.tsx, glow.tsx.
import { type CSSProperties, type FC, type ReactNode, createContext, createElement, useContext, useEffect, useRef, useState } from "react"
import { ICON, Icon } from "~/ui/living-room/Remote"
import { DEST, type Dest, LEVELS, MOODS, NEXT_EPISODES, POPULAR, QUIZ, QUIZ_GOAL, SEARCH_IDEAS, SIDES, TO_START, type Title, WISHLIST_MOVIES, discover, islandOf, islandTitles, moodName, search, sideOf, titleOf } from "~/ui/prototype-tv-flow/data"
import { parseId, useTv } from "~/ui/prototype-tv-flow/engine"
import { Corners, F, Layer, metaOf, useTitleActions } from "~/ui/prototype-tv-flow/kit"
import { backdropOf, posterOf } from "./art"

export type DirectionKey = "cinema" | "marquee" | "glow"
export const DIRECTIONS: Record<DirectionKey, { name: string; bet: string }> = {
	cinema: { name: "Cinema", bet: "The art does the work: the whole picture takes the backdrop of whatever has the focus." },
	marquee: { name: "Marquee", bet: "Words and colour do the work: huge type on flat colour, read from across the room." },
	glow: { name: "Glow", bet: "Light does the work: a warm, calm TV that belongs to the room; the focus is a lamp, not a line." },
}

/** The TV picture is drawn at this size; in the room on a 1920x1080 window it is shown at 1:1, so a canvas pixel is a screen pixel. */
export const CANVAS = { w: 1200, h: 648 }
/** The phone edition's canvas: narrower and taller, shown at 0.75 on a 390 px phone. */
export const PHONE_CANVAS = { w: 520, h: 640 }

export type Action = { id: string; label: string; onOk: () => void }
export type Item = { title: Title; id: string; sub?: string; onOk: () => void }
/** `title` lends the app its backdrop; `preview` is what the home shows of the app while it has the focus. */
export type AppInfo = { key: string; name: string; line: string; hue: number; title: Title; preview: Title[] }
export type MoodInfo = { key: string; name: string; line: string; hue: number; title: Title }

/** A visual direction: every screen of the apps flow, drawn its way. The flow hands it what to show and what each item does. */
export type Skin = {
	css: string
	Home: (p: { apps: AppInfo[]; greeting: string; open: (key: string) => void }) => ReactNode
	Moods: (p: { moods: MoodInfo[]; pick: (key: string) => void; dest: Dest }) => ReactNode
	/** A handful of titles: Discover's results, an island, a side of you, My shows, search results. */
	List: (p: { name: string; crumb?: string; dest: Dest; items: Item[]; actions: Action[]; actionsLabel?: string; empty?: string }) => ReactNode
	Map: (p: { open: (key: string) => void; dest: Dest }) => ReactNode
	/** One title, large: the title screen, and Tonight's pick. */
	TitleView: (p: { name: string; crumb?: string; title: Title; kicker: string; actions: Action[]; dest: Dest }) => ReactNode
	/** Taste before the person has one. */
	Taste: (p: { rated: number; start: Action; dest: Dest }) => ReactNode
	Sides: (p: { open: (key: string) => void; more: Action; dest: Dest }) => ReactNode
	/** One question, a few big answers: rating, the quiz, search, What is GoodWatch? */
	Ask: (p: { kicker: string; question: string; line?: string; answers: Action[]; title?: Title }) => ReactNode
	Menu: (p: { items: Action[] }) => ReactNode
}

/** The screen a piece is drawn on (under the menu, that is not the top of the stack), and where the expand key sits in the top bar. */
const ScreenCtx = createContext("home")
export const BarCtx = createContext<{ expandFirst: boolean }>({ expandFirst: false })

/** A skin's screen as an element: skins use hooks, so they are rendered, never called. */
const h = <P extends object>(component: (p: P) => ReactNode, props: P) => createElement(component as FC<P>, props)

/** A representative title per mood, for its art. */
const MOOD_ART: Record<string, string> = { funny: "the-good-place", cozy: "paddington-2", thrilling: "edge-of-tomorrow", mind: "arrival", dark: "severance", any: "spirited-away" }

export function DesignTv({ skin }: { skin: Skin }) {
	const tv = useTv()
	const overlay = tv.top === "menu"
	const id = overlay ? (tv.stack[tv.stack.length - 2] ?? "home") : tv.top
	// Which way the stack moved, so a direction can slide a screen in from the side it comes from.
	const depth = tv.stack.length - (overlay ? 1 : 0)
	const last = useRef({ depth, nav: "fwd" })
	if (last.current.depth !== depth) last.current = { depth, nav: depth > last.current.depth ? "fwd" : "back" }
	const items: Action[] = [
		{ id: "menu-home", label: "Home", onOk: tv.home },
		{ id: "menu-search", label: "Search", onOk: tv.openSearch },
		tv.member ? { id: "menu-account", label: "Account", onOk: () => tv.toast("Settings would open here") } : { id: "menu-signin", label: "Sign in", onOk: () => tv.toast("Continue with Google would open here") },
		{ id: "menu-about", label: "What is GoodWatch?", onOk: () => tv.replace("about") },
		{
			id: "menu-off",
			label: "Turn off",
			onOk: () => {
				tv.back()
				tv.power(false)
			},
		},
	]
	return (
		<>
			<Layer key={id} className="tvd-screen" style={{ "--nav": last.current.nav === "fwd" ? 1 : -1 } as CSSProperties}>
				<ScreenCtx.Provider value={id}>
					<Screen id={id} skin={skin} />
				</ScreenCtx.Provider>
			</Layer>
			{overlay && <Layer className="tvd-menu">{h(skin.Menu, { items })}</Layer>}
			{tv.toastText && (
				<div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center">
					<div className="tvd-toast">{tv.toastText}</div>
				</div>
			)}
		</>
	)
}

function Screen({ id, skin }: { id: string; skin: Skin }) {
	const tv = useTv()
	const [kind, arg] = parseId(id)
	const item = (title: Title, sub?: string, prefix = "t"): Item => ({ title, id: `${prefix}-${title.key}`, sub, onOk: () => tv.push(`title-${title.key}`) })
	switch (kind) {
		case "tonight": {
			const picks = (tv.member ? WISHLIST_MOVIES : POPULAR).slice(0, 3)
			const at = (Number(arg) || 0) % picks.length
			const x = picks[at]
			return h(skin.TitleView, {
				name: "Tonight",
				crumb: tv.member ? "From your Wishlist" : "Best rated right now",
				title: x,
				kicker: `Pick ${at + 1} of ${picks.length}`,
				dest: tv.member ? DEST.movies() : DEST.discover(),
				actions: [
					{ id: "details", label: "Details", onOk: () => tv.push(`title-${x.key}`) },
					{ id: "another", label: "Another one", onOk: () => tv.replace(`tonight-${(at + 1) % picks.length}`, true) },
				],
			})
		}
		case "discover": {
			if (!arg) {
				const moods = [...MOODS, { key: "any", name: "Any mood", line: "Surprise me.", hue: 180 }].map((m) => ({ ...m, title: titleOf(MOOD_ART[m.key]) }))
				return h(skin.Moods, { moods, pick: (key) => tv.push(`discover-${key}`), dest: DEST.discover() })
			}
			const mood = arg === "any" ? null : arg
			const hits = discover(mood, null, tv.store.service)
			return h(skin.List, {
				name: "Discover",
				crumb: [moodName(mood), tv.store.service && `only ${tv.store.service}`].filter(Boolean).join(", "),
				dest: DEST.discover(mood),
				items: hits.map((x) => item(x)),
				actions: [{ id: "change", label: "Change mood", onOk: tv.back }],
				empty: "Nothing fits.",
			})
		}
		case "explorer":
			return h(skin.Map, { open: (key) => tv.push(`island-${key}`), dest: DEST.explorer() })
		case "island": {
			const i = islandOf(arg)
			return h(skin.List, {
				name: "Explorer",
				crumb: i.name,
				dest: DEST.explorer(i.key),
				items: islandTitles(i.key).map((x) => item(x)),
				actionsLabel: "Sail to",
				actions: i.next.map((key) => ({ id: `hop-${key}`, label: islandOf(key).name, onOk: () => tv.replace(`island-${key}`) })),
			})
		}
		case "taste":
			return tv.taste
				? h(skin.Sides, { open: (key) => tv.push(`side-${key}`), more: { id: "start-quiz", label: "Rate more", onOk: () => tv.push("quiz") }, dest: DEST.taste() })
				: h(skin.Taste, { rated: tv.store.rated, start: { id: "start-quiz", label: tv.store.rated ? "Keep rating" : "Start rating", onOk: () => tv.push("quiz") }, dest: DEST.taste() })
		case "side": {
			const s = sideOf(arg)
			return h(skin.List, { name: "Taste", crumb: s.name, dest: DEST.taste(), items: s.titles.map((x) => item(x)), actions: [] })
		}
		case "shows":
			return h(skin.List, {
				name: "My shows",
				crumb: "Your next episodes",
				dest: DEST.shows(),
				items: [...NEXT_EPISODES.map((e) => item(e.title, `${e.code} · ${e.runtime}`, "ep")), ...TO_START.map((x) => item(x, "Start", "start"))],
				actions: [],
			})
		case "title":
			return <TitleScreen skin={skin} titleKey={arg} />
		case "rate": {
			const x = titleOf(arg)
			return h(skin.Ask, {
				kicker: "Seen it",
				question: `How was ${x.title}?`,
				title: x,
				answers: LEVELS.map((level) => ({
					id: `level-${level}`,
					label: level,
					onOk: () => {
						tv.rate(x.key, level)
						tv.back()
					},
				})),
			})
		}
		case "quiz": {
			const x = QUIZ[tv.store.quizAt % QUIZ.length]
			const answer = (level: string | null) => () => {
				if (tv.quiz(level)) tv.back()
			}
			return h(skin.Ask, {
				kicker: `Taste · ${Math.min(tv.store.rated, QUIZ_GOAL)} of ${QUIZ_GOAL} rated`,
				question: x.title,
				line: `${metaOf(x)}. Have you seen it?`,
				title: x,
				answers: [
					{ id: "q-loved", label: "Loved it", onOk: answer("Loved it") },
					{ id: "q-liked", label: "Liked it", onOk: answer("Liked it") },
					{ id: "q-no", label: "Not for me", onOk: answer("Not for me") },
					{ id: "q-skip", label: "Haven't seen it", onOk: answer(null) },
				],
			})
		}
		case "search": {
			if (arg) return h(skin.List, { name: "Search", crumb: `“${arg}”`, dest: DEST.search(arg), items: search(arg).map((x) => item(x)), actions: [] })
			const { draft } = tv.store
			const typed = draft.trim().length > 1
			return h(skin.Ask, {
				kicker: "Search",
				question: draft ? `${draft}▍` : "What are you looking for?",
				line: typed ? "OK searches for it." : "Type on the keyboard, or pick one.",
				answers: [...(typed ? [{ id: "go", label: `Search “${draft.trim()}”`, onOk: () => tv.push(`search-${draft.trim()}`) }] : []), ...SEARCH_IDEAS.slice(0, typed ? 3 : 4).map((q) => ({ id: `idea-${q}`, label: q, onOk: () => tv.push(`search-${q}`) }))],
			})
		}
		case "about":
			return h(skin.Ask, {
				kicker: "What is GoodWatch?",
				question: "One score, how it feels, where it streams.",
				line: "IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account needed.",
				answers: [
					{ id: "got-it", label: "Got it", onOk: tv.back },
					{ id: "rate", label: "Rate what I've seen", onOk: () => tv.replace("quiz") },
				],
			})
		default: {
			const apps: AppInfo[] = [
				{ key: "tonight", name: "Tonight", hue: 28, line: tv.member ? "One pick at a time, from your Wishlist." : "One pick at a time, best rated right now.", title: (tv.member ? WISHLIST_MOVIES : POPULAR)[0], preview: (tv.member ? WISHLIST_MOVIES : POPULAR).slice(0, 3) },
				{ key: "discover", name: "Discover", hue: 350, line: "Pick a mood, get four titles.", title: titleOf("the-good-place"), preview: discover("funny", null, null).slice(0, 3) },
				{ key: "explorer", name: "Explorer", hue: 200, line: "Sail a small map of islands.", title: titleOf("interstellar"), preview: islandTitles("space").slice(0, 3) },
				{ key: "taste", name: "Taste", hue: 265, line: tv.taste ? "Three sides of you." : `Rate ${QUIZ_GOAL} titles, get picks made for you.`, title: titleOf("arrival"), preview: SIDES[1].titles.slice(0, 3) },
				...(tv.member ? [{ key: "shows", name: "My shows", hue: 150, line: "Your next episodes.", title: NEXT_EPISODES[0].title, preview: NEXT_EPISODES.map((e) => e.title) }] : []),
			]
			return h(skin.Home, { apps, greeting: tv.member ? "Welcome back" : "Good evening", open: tv.push })
		}
	}
}

function TitleScreen({ skin, titleKey }: { skin: Skin; titleKey: string }) {
	const x = titleOf(titleKey)
	const actions = useTitleActions(x)
	return h(skin.TitleView, { name: x.kind === "movie" ? "Movie" : "Show", title: x, kicker: metaOf(x), actions, dest: DEST.title(x) })
}

// ---------------------------------------------------------------------------------------------------------
// The top bar's actions: the same group, in the same place, on every screen.

const MENU_ICON = "M4 7h16M4 12h16M4 17h16"

/**
 * Back, Search and Menu, and with them the expand key where a screen has a page to grow into. They do what the
 * Remote's keys do. An action that has nothing to do is not there: no Back on home, no Search on the search
 * screens, no Menu while the menu is open. The expand key stays apart from the three by a wider gap, last in the
 * row (the corner) or first, and it alone is amber. The direction dresses them (`cls`, `xcls`, the motif).
 * On the phone the three show their icons only.
 */
export function Actions({ dest, cls, xcls, motif, className = "" }: { dest?: Dest; cls: string; xcls: string; motif: { w: number; h: number; stroke: number }; className?: string }) {
	const tv = useTv()
	const screen = useContext(ScreenCtx)
	const { expandFirst } = useContext(BarCtx)
	const P = tv.phone
	const actions = [
		screen !== "home" && { id: "bar-back", label: "Back", d: ICON.back, onOk: tv.back },
		parseId(screen)[0] !== "search" && { id: "bar-search", label: "Search", d: ICON.search, onOk: tv.openSearch },
		tv.top !== "menu" && { id: "bar-menu", label: "Menu", d: MENU_ICON, onOk: tv.toggleMenu },
	].filter((a) => a !== false)
	const expand = dest && <Expand key="expand" dest={dest} className={xcls} motif={motif} />
	return (
		<div className={`flex shrink-0 items-center ${P ? "gap-4" : "gap-7"} ${className}`}>
			{expandFirst && expand}
			<div className={`flex items-center ${P ? "gap-2" : "gap-2.5"}`}>
				{actions.map((a) => (
					// `tvx`: like the expand key, an action is never where a screen's focus starts.
					<F key={a.id} id={a.id} onOk={a.onOk} label={a.label} className={`tvx flex shrink-0 items-center justify-center whitespace-nowrap ${cls}`}>
						<Icon d={a.d} className={P ? "h-[26px] w-[26px]" : "h-[28px] w-[28px]"} />
						{!P && a.label}
					</F>
				))}
			</div>
			{!expandFirst && expand}
		</div>
	)
}

/** A screen's name with its crumb under it: all the top bar holds besides the actions. */
export function BarTitle({ name, crumb, nameClass, crumbClass, style }: { name: string; crumb?: string; nameClass: string; crumbClass: string; style?: CSSProperties }) {
	return (
		<div className="min-w-0 flex-1">
			<div className={`truncate leading-none ${nameClass}`} style={style}>
				{name}
			</div>
			{crumb && <div className={`mt-1.5 truncate leading-tight ${crumbClass}`}>{crumb}</div>}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Art.

export function Img({ src, className = "", style }: { src: string; className?: string; style?: CSSProperties }) {
	return <img src={src} alt="" draggable={false} decoding="async" className={`object-cover ${className}`} style={style} />
}

/** Fills its box and cross-fades to the next content whenever `id` changes. */
export function Cross({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
	const [shown, setShown] = useState({ id, node: children, beforeId: "", before: null as ReactNode })
	if (shown.id !== id) setShown({ id, node: children, beforeId: shown.id, before: shown.node })
	return (
		<div className={`absolute inset-0 overflow-hidden ${className}`}>
			{shown.before && (
				<div key={shown.beforeId} className="absolute inset-0">
					{shown.before}
				</div>
			)}
			<div key={id} className="tvd-fade absolute inset-0">
				{children}
			</div>
		</div>
	)
}

/** A picture that fills its box and cross-fades to the next one. */
export function Ambient({ src, className = "" }: { src: string; className?: string }) {
	return (
		<Cross id={src} className={className}>
			<Img src={src} className="h-full w-full" />
		</Cross>
	)
}

/** The expand motif: a small picture, and the corner brackets that pull away from it while the control has the focus. */
export function Motif({ w, h, stroke }: { w: number; h: number; stroke: number }) {
	return (
		<span className="relative block shrink-0" style={{ width: w, height: h }}>
			<span className="absolute rounded-[3px] bg-current opacity-75" style={{ inset: "30%" }} />
			<span className="tvx-frame" style={{ "--in": "17%", "--out": "0%" } as CSSProperties}>
				<Corners len={Math.round(Math.min(w, h) * 0.28)} stroke={stroke} color="currentColor" />
			</span>
		</span>
	)
}

/**
 * The expand key, the one way out of the TV: always `expand`, always top right. Focusing it frames the whole
 * picture; OK grows the picture into the page. The direction dresses it (`className`, the motif's weight).
 */
export function Expand({ dest, className, motif }: { dest: Dest; className: string; motif: { w: number; h: number; stroke: number } }) {
	const tv = useTv()
	return (
		<F id="expand" onOk={() => tv.leave(dest, "expand", { framed: true })} label={`${tv.label}: ${dest.name}`} className={`tvx flex shrink-0 items-center whitespace-nowrap ${className}`}>
			<Motif {...motif} />
			{tv.label}
		</F>
	)
}

/** Explorer's identity: islands on the sea, joined by dotted bridges. Fills its box. */
export function MapArt({ sea = "#0d2a3a", className = "" }: { sea?: string; className?: string }) {
	const dots = [
		[70, 62, 46, 30, 40],
		[200, 44, 54, 34, 150],
		[322, 78, 44, 28, 15],
		[110, 150, 50, 30, 200],
		[250, 150, 56, 34, 320],
	]
	return (
		<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
			<rect width="400" height="220" fill={sea} />
			<path d="M70 62L200 44L322 78M70 62L110 150L250 150L322 78M200 44L250 150" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="3" strokeDasharray="1 10" strokeLinecap="round" />
			{dots.map(([x, y, rx, ry, hue]) => (
				<ellipse key={hue} cx={x} cy={y} rx={rx} ry={ry} fill={`hsl(${hue} 62% 52%)`} />
			))}
		</svg>
	)
}

/** Taste's identity: the ridges of a fingerprint. Fills its box. */
export function PrintArt({ ink = "#c4b5fd", ground = "#241538", className = "" }: { ink?: string; ground?: string; className?: string }) {
	return (
		<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
			<rect width="400" height="220" fill={ground} />
			{[26, 48, 70, 92, 114, 136].map((r, i) => (
				<path key={r} d={`M${200 - r} 150a${r} ${r * 1.05} 0 0 1 ${r * 2} 0${i % 2 ? `v${20 + i * 4}` : ""}`} fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round" opacity={1 - i * 0.11} />
			))}
		</svg>
	)
}

/** An app's picture: real art for Tonight, Discover and My shows, a drawing for Explorer and Taste. Fills its box. */
export function AppArt({ app, size = "w780", className = "" }: { app: AppInfo; size?: "w780" | "w1280"; className?: string }) {
	if (app.key === "explorer") return <MapArt className={className} />
	if (app.key === "taste") return <PrintArt className={className} />
	if (app.key === "discover")
		return (
			<span className={`flex ${className}`}>
				{["the-good-place", "knives-out", "spirited-away", "severance"].map((key) => (
					<Img key={key} src={posterOf(key)} className="h-full min-w-0 flex-1" />
				))}
			</span>
		)
	return <Img src={backdropOf(app.title, size)} className={className} />
}

// ---------------------------------------------------------------------------------------------------------
// The follower: one element that glides to wherever the focus is (a ring, or a pool of light).

/**
 * Sits in the picture and follows the focused item. `pad` grows it past the item; `size` makes it a square of
 * that size centred on the item instead. It eases toward the item on every frame for a short while after the
 * focus moved, so it also follows a row that is still paging. With reduced motion it jumps.
 */
export function Follower({ className, pad = 0, size }: { className: string; pad?: number; size?: number }) {
	const tv = useTv()
	const ref = useRef<HTMLDivElement>(null)
	const at = useRef<number[] | null>(null)
	const moved = `${tv.focus}|${tv.stack.join(".")}|${tv.phone}`
	// Runs again whenever the focus or the screen changed (`moved`).
	useEffect(() => {
		const el = ref.current
		const host = el?.parentElement
		if (!el || !host) return
		const jump = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const until = performance.now() + 700
		let raf = 0
		const tick = () => {
			const target = host.querySelector<HTMLElement>("[data-tv-item][aria-current]")
			if (!target) {
				el.style.opacity = "0"
				at.current = null
			} else {
				const h = host.getBoundingClientRect()
				const k = h.width / host.offsetWidth
				const b = target.getBoundingClientRect()
				const radius = Number.parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0
				const cx = (b.left + b.width / 2 - h.left) / k
				const cy = (b.top + b.height / 2 - h.top) / k
				const want = size ? [cx - size / 2, cy - size / 2, size, size, size / 2] : [(b.left - h.left) / k - pad, (b.top - h.top) / k - pad, b.width / k + 2 * pad, b.height / k + 2 * pad, radius + pad]
				const from = at.current
				const now = !from || jump ? want : want.map((v, i) => from[i] + (v - from[i]) * 0.38)
				at.current = now
				el.style.opacity = "1"
				el.style.transform = `translate(${now[0]}px, ${now[1]}px)`
				el.style.width = `${now[2]}px`
				el.style.height = `${now[3]}px`
				el.style.borderRadius = `${now[4]}px`
			}
			if (performance.now() < until) raf = requestAnimationFrame(tick)
		}
		tick()
		return () => cancelAnimationFrame(raf)
	}, [moved])
	return <div ref={ref} aria-hidden className={`pointer-events-none absolute left-0 top-0 opacity-0 ${className}`} />
}

/** The title that has the focus on a screen of titles, else the one that had it last, else the first. */
export function useFocusedTitle(items: Item[]): Title | null {
	const tv = useTv()
	const last = useRef<Title | null>(null)
	const now = items.find((i) => i.id === tv.focus)?.title
	if (now) last.current = now
	return now ?? (last.current && items.some((i) => i.title === last.current) ? last.current : (items[0]?.title ?? null))
}

/** A long title is set smaller, so it stays on two lines. */
export const titleSize = (title: string, large: number, small: number) => (title.length > 16 ? small : large)
