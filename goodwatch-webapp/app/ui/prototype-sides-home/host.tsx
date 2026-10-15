// PROTOTYPE - throwaway (#660). The TV the variants are drawn on: the real living room and Remote (TvRoom), or the
// TV's canvas filling the window (`&fit=screen`), with a small focus engine of its own in place of the TV's
// machine. The arrows and the Remote's wheel move the focus with the TV's own direction rule (tv-move.ts), Enter
// and OK choose, Escape, Backspace and Back go back, H goes home. A side's screen is the TV's own list of titles.
// Nothing leaves the TV: what would open another screen or page says so in the TV's toast.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { TV_CANVAS } from "~/ui/living-room/tv/room-layout"
import type { RoomKey, RoomTv, TvCanvas } from "~/ui/living-room/tv/room-tv"
import { Layer, TvViewProvider, type TvView } from "~/ui/living-room/tv/kit"
import { TitleList } from "~/ui/living-room/tv/TitleList"
import { TV_CANVAS_ATTR, TV_ITEM_ATTR, TV_LAYER_ATTR, bringIntoView, itemElement, measureItems, roomElement } from "~/ui/living-room/tv/tv-dom"
import { type TvDir, nextInDirection } from "~/ui/living-room/tv/tv-move"
import { TvRoom } from "~/ui/living-room/tv/TvRoom"
import { ROOM_ID } from "~/ui/living-room/use-below-room"
import { type HomeSide, type SidesHomeView, shareWords, sideTitle, watchNextHref } from "./model"

type Screen = { name: "home" } | { name: "side"; side: string }

/** What a variant may hook into: its own keys, and its own way of moving the focus. */
type Hooks = {
	/** Returns true when the variant handled the chosen item. */
	choose?: (item: string) => boolean
	/** The item the focus moves to, null to stay, undefined for the TV's direction rule. */
	move?: (dir: TvDir, from: string) => string | null | undefined
}

type Host = {
	view: SidesHomeView
	names: boolean
	/** Gives the focus to an item (a variant's own keys move it). */
	focus: (item: string) => void
	say: (words: string) => void
	setHooks: (hooks: Hooks) => void
}
const HostContext = createContext<Host | null>(null)
export function useHost(): Host {
	const host = useContext(HostContext)
	if (!host) throw new Error("Drawn inside SidesTv")
	return host
}
/** A variant's own keys and moves, for as long as it is on screen. */
export function useHooks(hooks: Hooks) {
	const { setHooks } = useHost()
	const latest = useRef(hooks)
	latest.current = hooks
	useEffect(() => {
		setHooks({ choose: (item) => latest.current.choose?.(item) ?? false, move: (dir, from) => latest.current.move?.(dir, from) })
		return () => setHooks({})
	}, [setHooks])
}

/** The Watch next key's words for a side: its moods. */
export const watchNextLabel = (side: HomeSide) => (side.moods.length ? `Watch next: ${side.moods.map((m) => m.name).join(" + ")}` : "Watch next")

function SideScreen({ side, names }: { side: HomeSide; names: boolean }) {
	const items = ["bar:back", ...side.picks.map((t) => `title:${t.key}`), `watch:${side.id}`]
	return (
		<TitleList
			name={sideTitle(side, names)}
			crumb={`${shareWords(side.share)} · ${side.count} titles you love${side.onServices ? " · picks on your services" : ""}`}
			items={items}
			titles={side.picks}
			actions={[{ id: `watch:${side.id}`, label: watchNextLabel(side), says: `${watchNextLabel(side)}, on Watch next` }]}
			empty="Nothing new for this side right now."
			art={side.backdrop}
		/>
	)
}

function topLayer(): HTMLElement | null {
	const layers = roomElement()?.querySelectorAll<HTMLElement>(`[${TV_LAYER_ATTR}]`)
	return layers?.[layers.length - 1] ?? null
}

export function SidesTv({ view, names, fit, renderHome }: { view: SidesHomeView; names: boolean; fit: "room" | "screen"; renderHome: () => ReactNode }) {
	const [stack, setStack] = useState<{ screen: Screen; focus: string }[]>([{ screen: { name: "home" }, focus: "" }])
	const top = stack[stack.length - 1]
	const [toast, setToast] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const hooks = useRef<Hooks>({})
	const setHooks = useCallback((next: Hooks) => {
		hooks.current = next
	}, [])
	const say = useCallback((words: string) => {
		setToast(words)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setToast(null), 2600)
	}, [])
	const focus = useCallback((item: string) => {
		setStack((s) => (s[s.length - 1].focus === item ? s : [...s.slice(0, -1), { ...s[s.length - 1], focus: item }]))
	}, [])

	const titleName = useCallback(
		(key: string) => {
			for (const side of view.sides) for (const t of [...side.picks, ...side.loved]) if (t.key === key) return t.title
			for (const pick of view.home.tonight) if (`${pick.card.media_type}-${pick.card.tmdb_id}` === key) return pick.card.title
			return "this title"
		},
		[view],
	)

	const choose = useCallback(
		(item: string) => {
			if (hooks.current.choose?.(item)) return
			const [kind, ...rest] = item.split(":")
			const arg = rest.join(":")
			if (item === "bar:back") return setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
			if (kind === "side") return setStack((s) => [...s, { screen: { name: "side", side: arg }, focus: "" }])
			if (kind === "watch") {
				const side = view.sides.find((one) => one.id === arg)
				if (side) say(`Opens Watch next${side.moods.length ? ` with ${side.moods.map((m) => m.name).join(" + ")}` : ""} (${watchNextHref(side)})`)
				return
			}
			if (kind === "title") return say(`Opens ${titleName(arg)}`)
			if (kind === "pick") return say(`Opens ${titleName(arg.split(":").slice(1).join(":"))}`)
			if (kind === "app") return say(`Opens ${arg[0].toUpperCase()}${arg.slice(1)}, as today`)
			if (kind === "service") return say("Opens the service's screen, as today")
		},
		[view, say, titleName],
	)

	const press = useCallback(
		(key: RoomKey) => {
			if (key.type === "move") {
				const from = top.focus
				const own = hooks.current.move?.(key.dir, from)
				const next = own !== undefined ? own : (() => {
					const { boxes, scale } = measureItems(from)
					return nextInDirection(boxes, from, key.dir, scale)
				})()
				if (next) focus(next)
			} else if (key.type === "ok") choose(top.focus)
			else if (key.type === "back") setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
			else if (key.type === "home") setStack((s) => [s[0]])
			else if (key.type === "service") say("Opens the service's screen, as today")
			else if (key.type === "search" || key.type === "menu") say("Not in this prototype")
		},
		[top.focus, focus, choose, say],
	)

	// The keyboard works like the Remote (use-tv.ts), without the search line.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			if (target.closest("input, textarea, select, [contenteditable], [data-proto-bar]")) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			const k: RoomKey | null =
				e.key === "ArrowUp"
					? { type: "move", dir: "up" }
					: e.key === "ArrowDown"
						? { type: "move", dir: "down" }
						: e.key === "ArrowLeft"
							? { type: "move", dir: "left" }
							: e.key === "ArrowRight"
								? { type: "move", dir: "right" }
								: e.key === "Enter"
									? { type: "ok" }
									: e.key === "Escape" || e.key === "Backspace"
										? { type: "back" }
										: e.key === "h" || e.key === "H"
											? { type: "home" }
											: null
			if (!k) return
			e.preventDefault()
			press(k)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [press])

	// The focus always rests on an item: a new screen starts on its first one, and the focused item's row pages to it.
	// The room draws the screen once it has measured the window, after this effect: it looks again each frame until
	// there is an item.
	useEffect(() => {
		let frame = 0
		const look = () => {
			const el = top.focus ? itemElement(top.focus) : null
			if (el) return bringIntoView(el, true)
			const first = topLayer()?.querySelector<HTMLElement>(`[${TV_ITEM_ATTR}]:not([${TV_ITEM_ATTR}^="bar:"])`)
			const id = first?.getAttribute(TV_ITEM_ATTR)
			if (id) focus(id)
			else frame = requestAnimationFrame(look)
		}
		look()
		return () => cancelAnimationFrame(frame)
	})

	const host = useMemo<Host>(() => ({ view, names, focus, say, setHooks }), [view, names, focus, say, setHooks])
	const room: RoomTv = useMemo(
		() => ({ power: "on", framed: false, menuOpen: false, searching: false, openService: null, press, point: (item) => focus(item) }),
		[press, focus],
	)
	const dispatch = useCallback<TvView["dispatch"]>(
		(action) => {
			if (action.type === "focus") focus(action.item)
			else if (action.type === "choose") {
				focus(action.item)
				choose(action.item)
			}
		},
		[focus, choose],
	)

	const screenKey = top.screen.name === "home" ? "home" : `side:${top.screen.side}`
	const sideOn = top.screen.name === "side" ? view.sides.find((s) => top.screen.name === "side" && s.id === top.screen.side) : undefined
	const draw = (canvas: TvCanvas) => (
		<TvViewProvider value={{ canvas, focused: top.focus, dispatch }}>
			<HostContext.Provider value={host}>
				<div className="tvc absolute inset-0 overflow-hidden" data-tv-toast={toast ? "" : undefined}>
					{canvas.edition === "phone" ? (
						<Layer>
							<div className="flex h-full items-center justify-center p-8 text-center text-[26px] text-white/80">
								This prototype draws the desktop TV only. Open it on a wider window.
							</div>
						</Layer>
					) : (
						<Layer key={screenKey} className={stack.length > 1 ? "tvc-screen" : ""}>
							{sideOn ? <SideScreen side={sideOn} names={names} /> : renderHome()}
						</Layer>
					)}
					{toast && <div className="tvc-toast absolute left-14 top-[26px] z-30 max-w-[1000px] truncate">{toast}</div>}
				</div>
			</HostContext.Provider>
		</TvViewProvider>
	)

	if (fit === "screen") return <FullScreen draw={draw} />
	return <TvRoom tv={room} startTitles={[]} services={view.home.services} renderScreen={draw} />
}

/** The TV's canvas filling the window, as a TV app would: for judging the screen at TV size. */
function FullScreen({ draw }: { draw: (canvas: TvCanvas) => ReactNode }) {
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	useEffect(() => {
		const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight })
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [])
	const scale = size ? Math.min(size.w / TV_CANVAS.w, size.h / TV_CANVAS.h) : 1
	const canvas: TvCanvas = useMemo(() => ({ edition: "desktop", ...TV_CANVAS, scale }), [scale])
	return (
		<div id={ROOM_ID} className="fixed inset-0 z-[1000] flex items-center justify-center bg-black">
			{size && (
				<div style={{ width: TV_CANVAS.w * scale, height: TV_CANVAS.h * scale }} className="relative overflow-hidden">
					<div {...{ [TV_CANVAS_ATTR]: "desktop" }} className="absolute left-0 top-0 origin-top-left" style={{ width: TV_CANVAS.w, height: TV_CANVAS.h, transform: `scale(${scale})` }}>
						{draw(canvas)}
					</div>
				</div>
			)}
		</div>
	)
}
