// The Feedback tab on every page: a quiet "Feedback" handle on the right edge, in the upper middle. This module is
// all the page loads at first: the tab itself, rendered on the server, fixed, so it never moves the page. The drawer
// and fix mode (FeedbackDock.tsx) load once the page is idle, or on the first pointer, focus or tap on the tab.
import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/20/solid"
import {
	type ComponentType,
	type MutableRefObject,
	type RefObject,
	forwardRef,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"

/** What the drawer tells the tab: open (pressed), out (drawn as the drawer's handle), away (phone fix mode). */
export type TabState = { open: boolean; out: boolean; away: boolean }

export type DockProps = {
	tabRef: RefObject<HTMLButtonElement>
	setTab: (state: TabState) => void
	/** The tab's tap, handled by the drawer once it's loaded. */
	toggleRef: MutableRefObject<() => void>
	/** The tab was tapped before the drawer loaded: open at once. */
	openNow: MutableRefObject<boolean>
	/** An error page: nothing on it to fix. */
	sendOnly: boolean
}

/** Phones: hidden while the page scrolls down, back on the first scroll up (transform only). Never while open. */
function useHideOnScrollDown(active: boolean) {
	const [hidden, setHidden] = useState(false)
	useEffect(() => {
		if (!active) {
			setHidden(false)
			return
		}
		const narrow = window.matchMedia("(max-width: 767px)")
		let last = window.scrollY
		let frame = 0
		const onScroll = () => {
			if (frame) return
			frame = requestAnimationFrame(() => {
				frame = 0
				const y = window.scrollY
				if (Math.abs(y - last) < 8) return
				setHidden(narrow.matches && y > last && y > 80)
				last = y
			})
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			cancelAnimationFrame(frame)
		}
	}, [active])
	return hidden
}

/**
 * Desktop: a vertical "Feedback" label on the right edge. Phones: a slim tab with the icon, a little lower. It never
 * moves and never goes away: it's the drawer's handle. While the drawer is out the tab is pressed: it takes the
 * drawer's colour and edge, its inner corners square off and a strip over its inner edge hides the seam, so tab and
 * drawer read as one shape.
 */
const Tab = forwardRef<
	HTMLButtonElement,
	TabState & { onToggle: () => void; onWarm: () => void }
>(function Tab({ open, out, away, onToggle, onWarm }, ref) {
	const hidden = useHideOnScrollDown(!out && !away)
	return (
		<button
			ref={ref}
			type="button"
			onClick={onToggle}
			onPointerEnter={onWarm}
			onFocus={onWarm}
			aria-expanded={open}
			aria-controls="feedback-drawer"
			aria-label="Feedback"
			data-feedback-private
			data-feedback-tab
			data-out={out || undefined}
			{...(away && { inert: "", "aria-hidden": true })}
			className={`group fixed right-0 flex cursor-pointer flex-col items-center gap-2.5 bg-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 max-md:top-[42%] max-md:h-16 max-md:w-10 max-md:justify-center md:top-[30%] md:px-2.5 md:pt-3.5 md:pb-4 ${
				out
					? "z-[1002] rounded-l-none text-white ring-1 ring-amber-500/30"
					: "z-[45] rounded-l-xl text-gray-200 shadow-[0_8px_30px_-6px_rgba(0,0,0,.7)] ring-1 ring-white/15 transition-[transform,opacity] ease-out hover:bg-gray-900 hover:text-white motion-reduce:transition-none"
			} ${hidden || away ? "translate-x-full" : ""} ${away ? "opacity-0" : ""}`}
		>
			{/* Covers the drawer's right edge where it meets the tab, so the two join. */}
			{out && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 -left-px w-0.5 bg-gray-950"
				/>
			)}
			<ChatBubbleLeftEllipsisIcon
				className={`size-5 shrink-0 text-amber-400 transition-transform ${out ? "" : "group-hover:scale-110"}`}
				aria-hidden
			/>
			<span className="rotate-180 text-sm font-semibold tracking-wide [writing-mode:vertical-rl] max-md:hidden">
				Feedback
			</span>
		</button>
	)
})

const loadDock = () => import("./FeedbackDock")

export function FeedbackTab({ sendOnly = false }: { sendOnly?: boolean }) {
	const tabRef = useRef<HTMLButtonElement>(null)
	const [tab, setTab] = useState<TabState>({
		open: false,
		out: false,
		away: false,
	})
	const [Dock, setDock] = useState<ComponentType<DockProps> | null>(null)
	const openNow = useRef(false)
	const loading = useRef(false)
	const warm = useCallback(() => {
		if (loading.current) return
		loading.current = true
		loadDock().then(
			(m) => setDock(() => m.default),
			() => {
				loading.current = false
			},
		)
	}, [])
	const toggleRef = useRef<() => void>(() => {
		openNow.current = true
		warm()
	})
	// The drawer's code after the page has settled, so the first tap opens it at once.
	useEffect(() => {
		const w = window as Window & {
			requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
			cancelIdleCallback?: (id: number) => void
		}
		if (w.requestIdleCallback) {
			const id = w.requestIdleCallback(warm, { timeout: 6000 })
			return () => w.cancelIdleCallback?.(id)
		}
		const t = window.setTimeout(warm, 3000)
		return () => window.clearTimeout(t)
	}, [warm])
	return (
		<>
			<Tab
				ref={tabRef}
				{...tab}
				onToggle={() => toggleRef.current()}
				onWarm={warm}
			/>
			{Dock && (
				<Dock
					tabRef={tabRef}
					setTab={setTab}
					toggleRef={toggleRef}
					openNow={openNow}
					sendOnly={sendOnly}
				/>
			)}
		</>
	)
}
