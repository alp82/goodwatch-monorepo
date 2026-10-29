// The Feedback tab on every page: a quiet "Feedback" handle on the right edge, in the upper middle. This module is
// all the page loads at first: the tab itself, rendered on the server, fixed, so it never moves the page. The drawer
// and fix mode (FeedbackDock.tsx) load once the page is idle, or on the first pointer, focus or tap on the tab.
// For members on phones (below lg), the closed tab stays out of the page's way: Feedback is a row in the account
// menu (ui/account/AccountPanels.tsx), and the tab shows only as the open drawer's handle. Guests keep the tab.
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
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

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
	/**
	 * Gives focus back as the drawer closes: to the tab where it shows when closed, else (members' phones, where the
	 * closed tab is hidden) to what opened the drawer, or the avatar key once the menu that held it has closed.
	 */
	focusBack: () => void
}

/**
 * Closed, below lg, on a page with the account menu's key (members): hidden, as the menu has the way to Feedback.
 * CSS, so the server's first paint is already right; guests and pages without the key keep the tab.
 */
const OUT_OF_THE_WAY = "max-lg:[body:has([data-account-key])_&]:hidden"

/** Whether the closed tab is hidden by OUT_OF_THE_WAY: below lg (64rem), on a page with the account key. */
const closedTabHidden = () =>
	!window.matchMedia("(min-width: 64rem)").matches &&
	!!document.querySelector("[data-account-key]")

/** Can take focus where it is: still on the page, drawn, and not in an inert part. */
const focusable = (el: HTMLElement | null | undefined): el is HTMLElement =>
	!!el &&
	el.isConnected &&
	el.getClientRects().length > 0 &&
	!el.closest("[inert]")

/** The account key that opens the account menu (ui/account/AccountKey.tsx) that is on show. */
const accountKey = () =>
	[...document.querySelectorAll<HTMLElement>("[data-account-key]")].find((el) =>
		focusable(el),
	) ?? null

/**
 * Desktop: a vertical "Feedback" label on the right edge. Phones: a slim tab with the icon, a little lower, shown
 * while the drawer is open (or for guests, who have no account menu to reach it from). It never moves: it's the drawer's handle. While the drawer is out the tab is pressed: it takes the
 * drawer's colour and edge, its inner corners square off and a strip over its inner edge hides the seam, so tab and
 * drawer read as one shape.
 */
const Tab = forwardRef<
	HTMLButtonElement,
	TabState & { onToggle: () => void; onWarm: () => void }
>(function Tab({ open, out, away, onToggle, onWarm }, ref) {
	return (
		<button
			ref={ref}
			type="button"
			onClick={onToggle}
			onPointerEnter={onWarm}
			onTouchStart={onWarm}
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
			} ${away ? "translate-x-full opacity-0" : "focus:translate-x-0"} ${open || out || away ? "" : OUT_OF_THE_WAY}`}
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
const loadDockOnIntent = reloadOnStaleChunk(loadDock)

/** Opens the drawer of the tab on the page, as tapping the tab does; null while no tab is mounted. */
let openFromElsewhere: ((opener: HTMLElement | null) => void) | null = null

/**
 * Opens the Feedback drawer (the command palette's "Send feedback", the account menu's Feedback row). `opener` is what opened
 * it, which gets the focus back when the drawer closes where the tab is hidden; the focused element by default.
 * False when the page has no Feedback tab.
 */
export function openFeedback(opener?: HTMLElement | null): boolean {
	if (!openFromElsewhere) return false
	openFromElsewhere(
		opener ??
			(document.activeElement instanceof HTMLElement
				? document.activeElement
				: null),
	)
	return true
}

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
	// The reader asked for the drawer (pointed at the tab, tapped it, opened it from elsewhere). A load that started in
	// the background at the first interaction doesn't reload the page when it fails; once the drawer is wanted, its
	// failure (a deploy removed the old chunk) loads again with the stale-chunk recovery.
	const wanted = useRef(false)
	const warm = useCallback(function warm(intent = false) {
		if (intent) wanted.current = true
		if (loading.current) return
		loading.current = true
		const pending = intent ? loadDockOnIntent() : loadDock()
		pending.then(
			(m) => setDock(() => m.default),
			() => {
				loading.current = false
				if (!intent && wanted.current) warm(true)
			},
		)
	}, [])
	const toggleRef = useRef<() => void>(() => {
		openNow.current = true
		warm(true)
	})
	const openRef = useRef(false)
	// Open, or handed over to phone fix mode: either way the drawer is already in use.
	openRef.current = tab.open || tab.away
	// What opened the drawer from elsewhere; null when the tab did.
	const opener = useRef<HTMLElement | null>(null)
	const focusBack = useCallback(() => {
		const tab = tabRef.current
		const to = !closedTabHidden()
			? tab
			: focusable(opener.current)
				? opener.current
				: accountKey()
		opener.current = null
		to?.focus({ preventScroll: true })
	}, [])
	useEffect(() => {
		openFromElsewhere = (from) => {
			if (openRef.current) return
			opener.current = from
			toggleRef.current()
		}
		return () => {
			openFromElsewhere = null
		}
	}, [])
	// The drawer's code (about 35 KB) at the first sign of use, so the first tap opens it at once, and a visitor who
	// only reads the first screen never asks for it.
	useEffect(() => onFirstInteraction(() => warm()), [warm])
	return (
		<>
			<Tab
				ref={tabRef}
				{...tab}
				onToggle={() => {
					opener.current = null
					toggleRef.current()
				}}
				onWarm={() => warm(true)}
			/>
			{Dock && (
				<Dock
					tabRef={tabRef}
					setTab={setTab}
					toggleRef={toggleRef}
					openNow={openNow}
					sendOnly={sendOnly}
					focusBack={focusBack}
				/>
			)}
		</>
	)
}
