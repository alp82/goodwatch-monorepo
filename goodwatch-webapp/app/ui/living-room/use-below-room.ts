// Where a guest is on the start page: in the living room, or in the section below it (#352).
//
// The URL owns it: `#browse` means below. Going below pushes a history entry, so browser Back returns to the room,
// and a reload or a link to `#browse` lands in the section. This hook is the only writer; it mirrors the state to
// `<html data-lr="room|below">`, which is what the stylesheet reads to let the page scroll or not.
//
// In the room the page never moves: the wheel, a swipe, and the keys are the room's and the Remote's. Below, the
// page scrolls like any page. The ways back are the back control, Escape, browser Back, and scrolling up to the
// very top.
//
// Without JavaScript the same two links work alone: `#browse:target` lets the page scroll (living-room.css).
import { useLocation, useNavigate } from "@remix-run/react"
import {
	type MouseEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"

/** The section's id, and the room's: the lip links to the first, the back control to the second. */
export const BELOW_ID = "browse"
export const ROOM_ID = "room"

export const isBelowHash = (hash: string) => hash === `#${BELOW_ID}`

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/** A plain press: a modified click opens the link the browser's way. */
const plainPress = (e: MouseEvent) =>
	!e.defaultPrevented &&
	e.button === 0 &&
	!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)

export type BelowRoom = {
	below: boolean
	/** Click handlers for the lip (`href="#browse"`) and the back control (`href="#room"`). */
	onDown: (e: MouseEvent) => void
	onBack: (e: MouseEvent) => void
}

export function useBelowRoom(enabled: boolean): BelowRoom {
	const location = useLocation()
	const navigate = useNavigate()
	// The server doesn't see the fragment, so the first render is always the room; the URL counts from then on.
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	const active = enabled && hydrated
	const below = active && isBelowHash(location.hash)
	const latest = useRef({ below, location })
	latest.current = { below, location }
	// A move the page makes itself: down while the URL change is on its way, up until the page is at the top.
	const moving = useRef<"down" | "up" | null>(null)
	// Keyboard focus started the move down: what has the focus on arrival is brought into view.
	const byFocus = useRef(false)

	const goBelow = useCallback(() => {
		const { below, location } = latest.current
		if (below) {
			document.getElementById(BELOW_ID)?.scrollIntoView()
			return
		}
		moving.current = "down"
		navigate(
			{ search: location.search, hash: BELOW_ID },
			{ state: { fromRoom: true } },
		)
	}, [navigate])

	const goRoom = useCallback(() => {
		const { below, location } = latest.current
		if (!below || moving.current === "up") return
		moving.current = "up"
		// Came down from the room on this visit: its history entry is the one before. Otherwise (a link to `#browse`)
		// the room takes this entry's place.
		if (location.state?.fromRoom) navigate(-1)
		else navigate({ search: location.search, hash: "" }, { replace: true })
	}, [navigate])

	useIsoLayoutEffect(() => {
		if (!active) return
		const html = document.documentElement
		html.dataset.lr = below ? "below" : "room"
		return () => {
			delete html.dataset.lr
		}
	}, [active, below])

	// The router moves the page on a URL change (to the section, or back to the top); this only tracks it.
	useEffect(() => {
		if (!active) return
		if (below) {
			moving.current = null
			if (!byFocus.current) return
			byFocus.current = false
			// After the router's own move to the section's top, which would leave a link further down out of view.
			const frame = requestAnimationFrame(() =>
				document.activeElement?.scrollIntoView({ block: "nearest" }),
			)
			return () => cancelAnimationFrame(frame)
		}
		if (window.scrollY <= 0) {
			moving.current = null
			return
		}
		moving.current = "up"
		const done = setTimeout(() => {
			moving.current = null
			if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" })
		}, 2000)
		return () => clearTimeout(done)
	}, [active, below])

	useEffect(() => {
		if (!active) return
		const onScroll = () => {
			const y = window.scrollY
			if (latest.current.below) {
				// Scrolled up to the very top: back in the room.
				if (y <= 0) goRoom()
				return
			}
			if (moving.current === "down") return
			if (moving.current === "up") {
				if (y <= 0) moving.current = null
				return
			}
			// Nothing moves the page while the room has it. Whatever did (a browser that scrolls a locked page, find in
			// page) is taken back.
			if (y > 0) window.scrollTo({ top: 0, behavior: "instant" })
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || !latest.current.below) return
			e.preventDefault()
			goRoom()
			document
				.querySelector<HTMLElement>(`a[href="#${BELOW_ID}"]`)
				?.focus({ preventScroll: true })
		}
		// Keyboard focus that lands in the section or the footer: the visitor is below.
		const onFocus = (e: FocusEvent) => {
			const target = e.target
			if (latest.current.below || !(target instanceof HTMLElement)) return
			if (!target.closest(`#${BELOW_ID}, footer`)) return
			if (target.matches(`a[href="#${BELOW_ID}"]`)) return
			byFocus.current = true
			goBelow()
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		window.addEventListener("keydown", onKey)
		document.addEventListener("focusin", onFocus)
		return () => {
			window.removeEventListener("scroll", onScroll)
			window.removeEventListener("keydown", onKey)
			document.removeEventListener("focusin", onFocus)
		}
	}, [active, goBelow, goRoom])

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
	return { below, onDown, onBack }
}
