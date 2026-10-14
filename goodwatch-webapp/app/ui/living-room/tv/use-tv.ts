// Binds the TV's machine (tv-machine.ts) to the page. Where each part of the TV's state lives:
// - the screen: the URL's search params, one browser history entry per TV screen
// - the in-app history depth: the history entry's state
// - power, the menu and its focus: React state
// - the focus: React state, never the URL. A focus move does not navigate. The focus of a screen that is left is
//   remembered under its history entry (focus-memory.ts), so Back, Forward and a reload give it back.
//
// The hook also measures: a direction is a `move` with the boxes of the items on show (tv-dom.ts), read at the
// moment of the key press. And it is where the keys come in: the keyboard, which works like the Remote, and both
// Remotes through the room's seam (`RoomKey`, room-tv.ts).
import {
	useLocation,
	useNavigate,
	useNavigationType,
	useSearchParams,
} from "@remix-run/react"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { focusKey, tabFocusMemory } from "./focus-memory"
import type { RoomKey, RoomTv } from "./room-tv"
import {
	TV_CANVAS_ATTR,
	TV_INPUT_ATTR,
	TV_ITEM_ATTR,
	bringIntoView,
	inputElement,
	itemElement,
	measureItems,
	roomElement,
} from "./tv-dom"
import {
	type TvAction,
	type TvContext,
	type TvEffect,
	type TvPower,
	type TvState,
	focusLeftBehind,
	focusedItem,
	readTvState,
	transition,
	writeTvParams,
} from "./tv-machine"

export const TV_BOOT_MS = 1700

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

type HistoryEntryState = { tvDepth?: number } | null

/** The effects that leave the page: the focus of the screen they leave is remembered for Back. */
const leaves = (effect: TvEffect) =>
	effect.type === "expand" || effect.type === "watch"

const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** The keys that stay the Remote's while the search screen's line has the browser's focus. Every other key types. */
const REMOTE_KEYS_WHILE_TYPING = new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Enter",
	"Escape",
])

export function useTv(ctx: TvContext, onEffect: (effect: TvEffect) => void) {
	const [params] = useSearchParams()
	const location = useLocation()
	const navigate = useNavigate()
	const [power, setPower] = useState<TvPower>("on")
	const [menu, setMenu] = useState<{ open: boolean; focus: string | null }>({
		open: false,
		focus: null,
	})
	const depth = (location.state as HistoryEntryState)?.tvDepth ?? 0

	// ---- The focus of the history entry on show.
	const entry = focusKey(location)
	const linked = params.get("focus")
	const memory = tabFocusMemory()
	const [focus, setFocus] = useState({ entry, item: linked })
	/** The focus the machine gave the screen a `push` or `replace` is on its way to. */
	const arriving = useRef<{ item: string | null } | null>(null)
	/** The entry of the last commit with its address and its screen's focus. */
	const shown = useRef<{ entry: string; search: string; focus: string } | null>(
		null,
	)
	const navigationType = useNavigationType()
	// Another entry arrived (a TV screen change, browser Back or Forward): its focus is the machine's when the TV
	// navigated there itself, else what the memory holds for it, else the link's. An entry that something else put
	// in the place of the one on show, with the same address, keeps the focus on show: calling off a page that was
	// on its way does that (tv-transition.ts).
	if (focus.entry !== entry) {
		const replaced =
			navigationType === "REPLACE" && shown.current?.search === location.search
		setFocus({
			entry,
			item: arriving.current
				? arriving.current.item
				: memory.recall(
						entry,
						(replaced ? shown.current?.focus : null) ?? linked,
					),
		})
	}
	// The entry the page arrived on. The server's HTML and the first render know the link's focus only; what the
	// memory holds for it (a reload, Back from a real page) follows before the first paint. Kept in a ref, so
	// running the effect twice gives the same focus.
	const landed = useRef<{ entry: string; item: string | null } | null>(null)
	// Once, for the entry the page arrived on.
	useIsoLayoutEffect(() => {
		landed.current ??= { entry, item: memory.recall(entry, linked) }
		const { item } = landed.current
		setFocus((now) =>
			now.entry === landed.current?.entry && now.item !== item
				? { entry: now.entry, item }
				: now,
		)
	}, [])

	const state: TvState = useMemo(
		() => ({
			...readTvState(params, ctx, depth),
			focus: focus.entry === entry ? focus.item : linked,
			power,
			menuOpen: menu.open,
			menuFocus: menu.focus,
		}),
		[params, ctx, depth, focus, entry, linked, power, menu],
	)
	const focused = focusedItem(state, ctx)
	const screenFocus = menu.open
		? focusedItem({ ...state, menuOpen: false }, ctx)
		: focused
	const latest = useRef({ state, ctx, onEffect, params, entry, focused })
	latest.current = { state, ctx, onEffect, params, entry, focused }

	// ---- Remembering the focus of an entry that is left: `shown`, and the focus a leaving action named for it.
	const left = useRef<string | null>(null)
	useIsoLayoutEffect(() => {
		const before = shown.current
		if (before && before.entry !== entry) {
			memory.remember(before.entry, left.current ?? before.focus)
			left.current = null
			arriving.current = null
		}
		shown.current = { entry, search: location.search, focus: screenFocus }
	})
	// Leaving the page (the Expand key, a link, a reload) remembers the focus of the screen on show.
	useEffect(() => {
		const remember = () => {
			if (shown.current)
				memory.remember(
					shown.current.entry,
					left.current ?? shown.current.focus,
				)
		}
		window.addEventListener("pagehide", remember)
		return () => {
			window.removeEventListener("pagehide", remember)
			remember()
		}
	}, [memory])

	const dispatch = useCallback(
		(action: TvAction) => {
			const now = latest.current
			const next = transition(now.state, action, now.ctx)
			setPower(next.state.power)
			setMenu((m) =>
				m.open === next.state.menuOpen && m.focus === next.state.menuFocus
					? m
					: { open: next.state.menuOpen, focus: next.state.menuFocus },
			)
			left.current =
				next.history !== "none" || next.effects.some(leaves)
					? focusLeftBehind(now.state, action, now.ctx)
					: null
			arriving.current = null
			if (next.history === "back") navigate(-1)
			else if (next.history !== "none") {
				arriving.current = { item: next.state.focus }
				const search = writeTvParams(next.state.screen, now.params).toString()
				navigate(
					{ search: search ? `?${search}` : "" },
					{
						replace: next.history === "replace",
						preventScrollReset: true,
						state: { tvDepth: next.state.depth },
					},
				)
			} else if (next.state.focus !== now.state.focus)
				setFocus({ entry: now.entry, item: next.state.focus })
			for (const effect of next.effects) now.onEffect(effect)
		},
		[navigate],
	)

	// Turning the set on boots, then shows home.
	useEffect(() => {
		if (power !== "booting") return
		const timer = setTimeout(() => dispatch({ type: "boot-done" }), TV_BOOT_MS)
		return () => clearTimeout(timer)
	}, [power, dispatch])

	// ---- The focused item on the page: its row pages it into view, and the browser's own focus follows the TV's
	// while it is on the TV, so Enter and Space on a focused item choose the item the TV shows as focused.
	const onTv = useRef(false)
	// Runs again for a new screen with the same focus, and when the menu opens or closes.
	useEffect(() => {
		if (power !== "on") return
		const el = itemElement(focused)
		if (!el) return
		bringIntoView(el, !reducedMotion())
		const active = document.activeElement
		// The search screen's line keeps the browser's focus while the TV's focus moves: what is typed goes on
		// landing in it, and a phone's keyboard stays open.
		if (active instanceof HTMLElement && active.closest(`[${TV_INPUT_ATTR}]`))
			return
		const held =
			active instanceof HTMLElement && active.closest(`[${TV_CANVAS_ATTR}]`)
		// An item that had the browser's focus and left with its screen leaves the focus on the page's body.
		const lost = onTv.current && (!active || active === document.body)
		if ((held || lost) && active !== el) el.focus({ preventScroll: true })
	}, [focused, entry, menu.open, power])
	useEffect(() => {
		const onFocus = (e: FocusEvent) => {
			const target = e.target instanceof HTMLElement ? e.target : null
			onTv.current = Boolean(target?.closest(`[${TV_CANVAS_ATTR}]`))
			// The Tab key walks the items: the TV's focus follows the browser's.
			const item = target
				?.closest(`[${TV_ITEM_ATTR}]`)
				?.getAttribute(TV_ITEM_ATTR)
			if (item && onTv.current && item !== latest.current.focused)
				dispatch({ type: "focus", item })
		}
		window.addEventListener("focusin", onFocus)
		return () => window.removeEventListener("focusin", onFocus)
	}, [dispatch])

	// ---- The Remotes.
	const press = useCallback(
		(key: RoomKey) => {
			switch (key.type) {
				case "move": {
					const { focused } = latest.current
					const measured = measureItems(focused)
					// The focused item is not on the page (its screen's code is still on its way): the focus goes to
					// the first item that is, so it is never lost.
					if (
						measured.boxes.length &&
						!measured.boxes.some((box) => box.id === focused)
					)
						return dispatch({ type: "focus", item: measured.boxes[0].id })
					return dispatch({ type: "move", dir: key.dir, ...measured })
				}
				case "step":
					return dispatch({ type: "step", by: key.by })
				case "search":
					return dispatch({ type: "open-search" })
				case "menu":
					return dispatch({ type: "toggle-menu" })
				case "service":
					return dispatch({ type: "service-key", service: key.service })
				case "power":
					return dispatch({ type: "power", on: key.on })
				default:
					return dispatch({ type: key.type })
			}
		},
		[dispatch],
	)

	// ---- The keyboard works like the Remote: the arrows move, Enter is OK, Escape and Backspace are Back, H is
	// Home, M is the menu, S is search ("/" is the site's own search). While the set is off, any key turns it on.
	//
	// On the search screen the keyboard types. Its line is a real input: while it has the browser's focus, only the
	// arrows, Enter and Escape are the Remote's, and every other key is the input's own. With the browser's focus
	// anywhere else (a key of the Remote was clicked, an idea was reached with Tab), a key that types gives the
	// line the focus first and then lands in it, so H, M and S are letters there.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			const typing = Boolean(target.closest(`[${TV_INPUT_ATTR}]`))
			if (typing) {
				// Shift with an arrow selects, and a key that ends a composition is the keyboard's own.
				if (!REMOTE_KEYS_WHILE_TYPING.has(e.key) || e.shiftKey || e.isComposing)
					return
			} else if (target.closest("input, textarea, select, [contenteditable]"))
				return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			// Buttons have their own Enter and Space.
			if ((e.key === "Enter" || e.key === " ") && target.closest("button, a"))
				return
			// Scrolled out of the window, the room takes no input: the keys are the page's.
			if (roomElement()?.hasAttribute("inert")) return
			if (latest.current.state.power === "off") {
				press({ type: "power", on: true })
				e.preventDefault()
				return
			}
			// What is typed belongs to the line of the screen on show. Backspace deletes there while there is
			// something to delete; on an empty line it is Back, as everywhere.
			const line = typing ? null : inputElement()
			if (line && (e.key.length === 1 || (e.key === "Backspace" && line.value))) {
				line.focus({ preventScroll: true })
				return
			}
			switch (e.key) {
				case "ArrowUp":
					press({ type: "move", dir: "up" })
					break
				case "ArrowDown":
					press({ type: "move", dir: "down" })
					break
				case "ArrowLeft":
					press({ type: "move", dir: "left" })
					break
				case "ArrowRight":
					press({ type: "move", dir: "right" })
					break
				case "Enter":
					press({ type: "ok" })
					break
				case "Escape":
				case "Backspace":
					press({ type: "back" })
					break
				case "h":
				case "H":
					press({ type: "home" })
					break
				case "m":
				case "M":
					press({ type: "menu" })
					break
				case "s":
				case "S":
					press({ type: "search" })
					break
				default:
					return
			}
			e.preventDefault()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [press])

	// The menu lies over the screen and its key; a dark or booting TV shows no screen.
	const framed = power === "on" && !menu.open && focused === "expand"
	const openService =
		state.screen.name === "service" ? state.screen.service : null
	const room: RoomTv = useMemo(
		() => ({
			power,
			framed,
			menuOpen: menu.open,
			searching: state.screen.name === "search",
			// A streaming key is lit while its service's screen shows.
			openService,
			press,
			point: (item) => dispatch({ type: "focus", item }),
		}),
		[
			power,
			menu.open,
			state.screen.name,
			framed,
			openService,
			press,
			dispatch,
		],
	)

	return {
		state,
		screen: state.screen,
		/** The focused item: the menu's while it is open, else the screen's. */
		focused,
		/** The screen's focused item, also under the open menu. */
		screenFocus,
		dispatch,
		/** What the room shows of the TV, and where the Remotes' keys go. */
		room,
	}
}

export type Tv = ReturnType<typeof useTv>
