// The start page's mood picker: My movies' taste picker (watch-next/MoodPicker.tsx, TasteShelf.tsx) with the guest's
// lines. Under the search bar: the mood button ("Any mood" with its color fan, then "Add" or "Change"), the picks as
// poster chips with a reading scrim (a whole mix by its name, then the other words), and "N titles" or "Pick up to
// three". The panel holds "Start with a mix" (the eight mixes, mixes.ts) and then Moods, Themes, and Styles, folded.
//
// The panel overlays: it hangs in a layer over the page under the picker row and scrolls with it, so nothing behind it
// moves and no scroll frame measures. It runs down to 16 px above the window's bottom (above the phone's dock); with
// less than 360 px left there, the page first scrolls it up to 72 px from the top. Solid gray-900 with no blur: the
// room's light changes behind it. Picks keep it open; Done closes it and brings the card into view.
import { AnimatePresence, motion } from "framer-motion"
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import type { PickerPicturesResponse } from "~/routes/api.start-picker-pictures"
import { useGuestBody } from "~/ui/discover/useDiscoverBrowse"
import {
	MoodButton,
	type MoodControl,
	MoodGrid,
	PanelHead,
	useRefusalHint,
} from "~/ui/watch-next/MoodPicker"
import { PickChip, type ShelfLines } from "~/ui/watch-next/TasteShelf"
import { EASE } from "~/ui/watch-next/style"
import type { TitleKey } from "~/utils/title-key"
import { displayPicks, pickLabel, tapPick } from "./mixes"
import { countScopeOf, countText } from "./mood-counts"
import {
	PANEL_LINE,
	type PanelBox,
	panelBox,
	resizedBox,
	startPicker,
	startShelfLines,
} from "./start-picker"
import { useMoodCounts } from "./useMoodCounts"

let picturesAsked: Promise<Record<string, string>> | null = null

/** The tiles' pictures, asked for once per page load when the picker first opens; none until they arrive. */
function usePickerPictures(wanted: boolean): Record<string, string> {
	const [pictures, setPictures] = useState<Record<string, string>>({})
	useEffect(() => {
		if (!wanted) return
		picturesAsked ??= fetch("/api/start-picker-pictures")
			.then((r) =>
				r.ok ? (r.json() as Promise<PickerPicturesResponse>) : null,
			)
			.then((body) => body?.pictures ?? {})
			.catch(() => ({}))
		let live = true
		picturesAsked.then((p) => {
			if (live) setPictures(p)
			// An empty answer (the catalog still loading) may be asked for again on the next open.
			if (!Object.keys(p).length) picturesAsked = null
		})
		return () => {
			live = false
		}
	}, [wanted])
	return pictures
}

export function StartMoodPicker({
	picks,
	setPicks,
	clearPicks,
	member,
	ranked = null,
	onDone,
}: {
	/** The picks: word ids, up to three (a mix is its parts). */
	picks: readonly string[]
	setPicks: (picks: readonly string[]) => void
	clearPicks: () => void
	/** A member counts by their own Discover defaults; a guest by the services they saved. */
	member: boolean
	/** The search's ranked list while a search is on (the counts are then of its titles); null without one. */
	ranked?: readonly TitleKey[] | null
	/** Done was pressed: the guest has asked. */
	onDone?: () => void
}) {
	const [open, setOpen] = useState(false)
	const guest = useGuestBody(member)
	const scope = countScopeOf(guest === undefined ? { services: null } : guest)
	const counts = useMoodCounts({
		picks,
		ranked,
		guest,
		scope,
		active: open || picks.length > 0,
	})
	const [opened, setOpened] = useState(false)
	if (open && !opened) setOpened(true)
	const pictures = usePickerPictures(opened)
	const [refused, setRefused] = useState<MoodControl["refused"]>(null)
	const picker = useMemo(
		() => startPicker(picks, counts, pictures),
		[picks, counts, pictures],
	)
	const shelf = useMemo(
		() => startShelfLines(picks, counts, scope),
		[picks, counts, scope],
	)
	const control: MoodControl = {
		picker,
		countScope: scope === "mine" ? "on your services" : "titles",
		open,
		setOpen,
		toggle: (id) => {
			const tap = tapPick(picks, id)
			if (tap.refused) setRefused({ name: pickLabel(id), at: Date.now() })
			else setPicks(tap.picks)
		},
		clear: clearPicks,
		refused,
	}
	const row = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	return (
		<>
			<div
				ref={row}
				className="-mx-4 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-1"
			>
				<div className="flex h-11 w-max items-center gap-2 lg:h-12">
					<span className="inline-flex shrink-0 rounded-full bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)] [&>button]:h-10 [&>button]:text-[15px] lg:[&>button]:h-11">
						<MoodButton control={control} buttonRef={button} />
					</span>
					{displayPicks(picks).map((id) => (
						<span
							key={id}
							className="inline-flex rounded-xl bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)]"
						>
							<PickChip
								control={control}
								id={id}
								pinned={false}
								scrim
								count={false}
							/>
						</span>
					))}
					<span className="shrink-0 whitespace-nowrap pl-1 text-sm tabular-nums text-gray-300 [text-shadow:0_1px_8px_rgb(0_0_0/.9)]">
						{picks.length
							? counts
								? countText(counts.total, scope)
								: ""
							: "Pick up to three"}
					</span>
				</div>
			</div>
			<StartMoodPanel
				control={control}
				shelf={shelf}
				anchor={row}
				returnFocus={button}
				onDone={() => {
					setOpen(false)
					button.current?.focus({ preventScroll: true })
					onDone?.()
					if (picks.length)
						requestAnimationFrame(() =>
							document
								.getElementById("start-card")
								?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
						)
				}}
			/>
			<RefusalLive control={control} />
		</>
	)
}

/** Says a refused fourth pick out loud while the panel is closed (its head shows it while open). */
function RefusalLive({ control }: { control: MoodControl }) {
	const hint = useRefusalHint(control)
	return (
		<span className="sr-only" aria-live="polite">
			{control.open ? "" : (hint ?? "")}
		</span>
	)
}

/** What the panel's place depends on, read from the page. */
function windowFacts(anchor: HTMLElement) {
	const vh = window.visualViewport?.height ?? window.innerHeight
	const dock = document.querySelector<HTMLElement>("[data-mobile-dock]")
	// The dock is fixed (no offsetParent); hidden from 1024 px.
	const dockBox = dock?.getBoundingClientRect()
	const dockTop = dockBox?.height ? dockBox.top : vh
	const column = (
		anchor.closest(".start-moods") ?? anchor
	).getBoundingClientRect()
	const scroller = document.scrollingElement ?? document.documentElement
	return {
		row: anchor.getBoundingClientRect(),
		column: { left: column.left + window.scrollX, width: column.width },
		bottom: Math.min(vh, dockTop),
		scrollY: window.scrollY,
		room: scroller.scrollHeight - vh - window.scrollY,
	}
}

function StartMoodPanel({
	control,
	shelf,
	anchor,
	returnFocus,
	onDone,
}: {
	control: MoodControl
	shelf: ShelfLines
	anchor: RefObject<HTMLElement | null>
	returnFocus: RefObject<HTMLButtonElement | null>
	onDone: () => void
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<PanelBox | null>(null)
	const { open, setOpen } = control
	const close = useCallback(() => setOpen(false), [setOpen])

	// Placed on open and on resizes (the window's or the visual viewport's), never per scroll frame.
	useLayoutEffect(() => {
		if (!open) {
			setBox(null)
			return
		}
		const el = anchor.current
		if (!el) return
		const first = panelBox(windowFacts(el))
		setBox(first)
		if (first.scrollBy)
			window.scrollBy({ top: first.scrollBy, behavior: "smooth" })
		const onResize = () => {
			if (!anchor.current) return
			const facts = windowFacts(anchor.current)
			setBox((current) => current && resizedBox(current, facts))
		}
		window.addEventListener("resize", onResize)
		window.visualViewport?.addEventListener("resize", onResize)
		return () => {
			window.removeEventListener("resize", onResize)
			window.visualViewport?.removeEventListener("resize", onResize)
		}
	}, [open, anchor])

	// Closes on a tap outside the panel and the mood buttons, and on Escape (focus back on the button).
	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			if (
				!panel.current?.contains(target) &&
				!target.closest("[data-moodbutton]")
			)
				close()
		}
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			close()
			returnFocus.current?.focus({ preventScroll: true })
		}
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", onEscape)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", onEscape)
		}
	}, [open, close, returnFocus])

	// Focus moves to the first choice when the panel opens.
	const placed = box !== null
	useEffect(() => {
		if (!open || !placed) return
		const id = requestAnimationFrame(() =>
			panel.current
				?.querySelector<HTMLElement>("[data-choice]")
				?.focus({ preventScroll: true }),
		)
		return () => cancelAnimationFrame(id)
	}, [open, placed])

	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{open && box && (
				<motion.div
					key="start-moods"
					ref={panel}
					// biome-ignore lint/a11y/useSemanticElements: a non-modal popover under the picker row
					role="dialog"
					aria-label="Picks"
					initial={{ opacity: 0, y: -8, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 0.985 }}
					transition={{ duration: 0.2, ease: EASE }}
					className="absolute z-40 flex origin-top flex-col overflow-hidden rounded-2xl bg-gray-900 text-white shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12"
					style={{
						top: box.top,
						left: box.left,
						width: box.width,
						maxHeight: box.maxHeight,
					}}
				>
					<PanelHead control={control} onDone={onDone} line={PANEL_LINE} />
					<MoodGrid control={control} shelf={shelf} />
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}
