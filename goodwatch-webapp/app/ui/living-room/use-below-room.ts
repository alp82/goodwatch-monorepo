// How the start page moves between the living room and the section below it (#352). This hook is the one owner.
//
// A visit starts locked: the room is the whole first screen and the page doesn't move. The wheel, a swipe, and the
// keys are the room's and the Remote's. The lip at the room's bottom edge is the way down.
//
// The first arrival below opens the page for the rest of the tab's session: a press of the lip, a link to
// `#browse`, or keyboard focus that lands in the section. From then on the page scrolls like any page, between the
// room and the section and back, also after leaving the start page and returning. A new tab starts locked again.
//
// - `<html data-lr="locked|open">` is what the stylesheet reads (living-room.css). Open is remembered in
//   sessionStorage, or in memory when storage is refused.
// - The lip is a link to `#browse`. A press pushes that history entry, so browser Back returns to the room, and a
//   reload or a shared link lands in the section. The router moves the page on a URL change.
// - The ways back are the back control, Escape, browser Back, and, once open, plain scrolling.
// - While the room is mostly out of the window (`away`), it takes no input and the keys are the page's.
// - Phone landscape: the room covers the whole window, so it can't scroll away. Going below slides it out of the
//   window (`<html data-lr-below>`, while the URL ends in `#browse`).
//
// Without JavaScript the same two links work alone: `#browse:target` lets the page scroll.
import { useLocation, useNavigate } from "@remix-run/react"
import {
	type MouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"

/** The section's id, and the room's: the lip links to the first, the back control to the second. */
export const BELOW_ID = "browse"
export const ROOM_ID = "room"

export const isBelowHash = (hash: string) => hash === `#${BELOW_ID}`

/** living-room.css has the same query for the room that covers the window. */
const LANDSCAPE =
	"(orientation: landscape) and (max-height: 540px) and (min-width: 768px)"

const OPEN_KEY = "living-room:open"
let openInMemory = false

function wasOpened(): boolean {
	try {
		return openInMemory || sessionStorage.getItem(OPEN_KEY) === "1"
	} catch {
		return openInMemory
	}
}

function rememberOpened() {
	openInMemory = true
	try {
		sessionStorage.setItem(OPEN_KEY, "1")
	} catch {
		// Without storage the page stays open until the tab reloads.
	}
}

/** A plain press: a modified click opens the link the browser's way. */
const plainPress = (e: MouseEvent) =>
	!e.defaultPrevented &&
	e.button === 0 &&
	!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)

export type BelowRoom = {
	/** The room is mostly out of the window (or, in phone landscape, slid out of it): it takes no input. */
	away: boolean
	/** Click handlers for the lip (`href="#browse"`) and the back control (`href="#room"`). */
	onDown: (e: MouseEvent) => void
	onBack: (e: MouseEvent) => void
}

export function useBelowRoom(): BelowRoom {
	const location = useLocation()
	const navigate = useNavigate()
	// The server sees neither the fragment nor the session: the first render is always the locked room.
	const [hydrated, setHydrated] = useState(false)
	const [open, setOpen] = useState(false)
	const [scrolledAway, setScrolledAway] = useState(false)
	const [landscape, setLandscape] = useState(false)
	const atBelow = hydrated && isBelowHash(location.hash)
	const latest = useRef({ open, atBelow, landscape, location })
	latest.current = { open, atBelow, landscape, location }
	// The press that opens the page: its URL change is on its way, so the lock leaves the page alone.
	const leaving = useRef(false)
	// The back control asked for the room: once the URL has changed, the page goes to its top.
	const toTop = useRef(false)

	useEffect(() => {
		setHydrated(true)
		// With the same render as `hydrated`: a visit that starts at `#browse` is never locked, not for a moment.
		setOpen(wasOpened() || isBelowHash(window.location.hash))
		const query = window.matchMedia(LANDSCAPE)
		const update = () => setLandscape(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])

	// Any arrival below opens the page for the session.
	useEffect(() => {
		if (!atBelow) return
		rememberOpened()
		setOpen(true)
	}, [atBelow])
	useEffect(() => {
		if (!open) return
		leaving.current = false
		const room = document.getElementById(ROOM_ID)
		setScrolledAway(window.scrollY > (room?.offsetHeight ?? 0) / 2)
	}, [open])

	useEffect(() => {
		if (!hydrated) return
		const html = document.documentElement
		html.dataset.lr = open ? "open" : "locked"
		html.toggleAttribute("data-lr-below", atBelow)
		return () => {
			delete html.dataset.lr
			html.removeAttribute("data-lr-below")
		}
	}, [hydrated, open, atBelow])

	useEffect(() => {
		if (atBelow || !toTop.current) return
		toTop.current = false
		// After the router has put the page where that history entry was left. A smooth move can be cut short by
		// another one, so it is asked for once more unless the visitor has taken over.
		let taken = false
		const take = () => {
			taken = true
		}
		window.addEventListener("wheel", take, { passive: true, once: true })
		window.addEventListener("touchstart", take, { passive: true, once: true })
		const frame = requestAnimationFrame(() => window.scrollTo({ top: 0 }))
		const again = setTimeout(() => {
			if (!taken && window.scrollY > 0) window.scrollTo({ top: 0 })
		}, 900)
		return () => {
			cancelAnimationFrame(frame)
			clearTimeout(again)
			window.removeEventListener("wheel", take)
			window.removeEventListener("touchstart", take)
		}
	}, [atBelow])

	const goBelow = useCallback(() => {
		const { atBelow, location } = latest.current
		if (atBelow) {
			document.getElementById(BELOW_ID)?.scrollIntoView()
			return
		}
		leaving.current = true
		navigate(
			{ search: location.search, hash: BELOW_ID },
			{ state: { fromRoom: true } },
		)
	}, [navigate])

	const goRoom = useCallback(() => {
		const { atBelow, location } = latest.current
		if (!atBelow) {
			window.scrollTo({ top: 0 })
			return
		}
		toTop.current = true
		// Came down from the room on this visit: its history entry is the one before. Otherwise (a link to `#browse`)
		// the room takes this entry's place.
		if (location.state?.fromRoom) navigate(-1)
		else navigate({ search: location.search, hash: "" }, { replace: true })
	}, [navigate])

	useEffect(() => {
		if (!hydrated) return
		const room = () => document.getElementById(ROOM_ID)
		const onScroll = () => {
			const y = window.scrollY
			if (latest.current.open) {
				setScrolledAway(y > (room()?.offsetHeight ?? 0) / 2)
				return
			}
			// Locked: nothing moves the page. Whatever did (a browser that scrolls a locked page, find in page) is
			// taken back.
			if (y > 0 && !leaving.current)
				window.scrollTo({ top: 0, behavior: "instant" })
		}
		onScroll()
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			const { atBelow } = latest.current
			if (!atBelow && window.scrollY <= (room()?.offsetHeight ?? 0) / 2) return
			e.preventDefault()
			goRoom()
			document
				.querySelector<HTMLElement>(`a[href="#${BELOW_ID}"]`)
				?.focus({ preventScroll: true })
		}
		// Keyboard focus that lands in the section or the footer while the page is locked: that is an arrival below.
		// The browser has already brought the element into view.
		const onFocus = (e: FocusEvent) => {
			const target = e.target
			const { open, atBelow, landscape } = latest.current
			if (!(target instanceof HTMLElement)) return
			if (!target.closest(`#${BELOW_ID}, footer`)) return
			if (target.matches(`a[href="#${BELOW_ID}"]`)) return
			// In phone landscape the room covers what has the focus until it slides out.
			if (landscape && !atBelow) {
				goBelow()
				return
			}
			if (open) return
			leaving.current = true
			rememberOpened()
			setOpen(true)
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("keydown", onKey)
		document.addEventListener("focusin", onFocus)
		return () => {
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("keydown", onKey)
			document.removeEventListener("focusin", onFocus)
		}
	}, [hydrated, goBelow, goRoom])

	const onDown = useCallback(
		(e: MouseEvent) => {
			if (!plainPress(e)) return
			e.preventDefault()
			goBelow()
		},
		[goBelow],
	)
	const onBack = useCallback(
		(e: MouseEvent) => {
			if (!plainPress(e)) return
			e.preventDefault()
			goRoom()
		},
		[goRoom],
	)
	return { away: landscape ? atBelow : open && scrolledAway, onDown, onBack }
}
