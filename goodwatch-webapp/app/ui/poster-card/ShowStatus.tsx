// A show's status from a poster card, for a member: the same choices as the title page's status half
// (ui/tracking/HeroStatus.tsx). Not started: Watching (which asks for the last episode seen), Seen, and Not
// interested. Started: the status menu. A show without an episode list, or whose tracking can't be read, has Seen for
// the whole show. Loaded the first time a card's status button is pressed; it stays mounted afterwards, because it
// hosts the toasts (with Undo) that tracking answers with.
import { NoSymbolIcon } from "@heroicons/react/20/solid"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { Choices } from "~/ui/tracking/HeroStatus"
import { StatusMenu } from "~/ui/tracking/HeroTracking"
import { POPOVER, TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { useTrackingActions } from "~/ui/tracking/actions"
import { useShowTracking } from "~/ui/tracking/store"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"
import { FOCUS } from "./look"

export default function ShowStatus({
	media,
	anchor,
	onClose,
	onHide,
}: {
	media: ScoredMedia
	/** The button that opened the menu; null while it is closed. */
	anchor: HTMLElement | null
	onClose: () => void
	/** Not interested was turned on; `undo` takes it back. */
	onHide: (undo: () => void) => void
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const a = useTitleActions(media)
	const { view } = tracking

	let body: ReactNode
	if (!tracking.ready || !view) {
		body =
			tracking.failed || tracking.page ? (
				// No episode list: Seen for the whole show, as the title page has it then.
				<MenuRow
					label={a.seen ? "Take back Seen" : "Seen"}
					note={
						a.seen ? "The show goes back to Not started." : "The whole show"
					}
					onClick={() => {
						onClose()
						// The card asks for a score once the show is Seen.
						a.toggleSeen(null, null)
					}}
				/>
			) : (
				<p className="px-3 py-2.5 text-sm text-gray-400" aria-live="polite">
					Loading your episodes…
				</p>
			)
	} else if (view.derived.state === "not_started") {
		body = (
			<div className="p-1">
				<Choices tracking={tracking} actions={actions} onDone={onClose} />
				{(a.canHide || a.hidden) && (
					<button
						type="button"
						aria-pressed={a.hidden}
						disabled={a.hidePending}
						onClick={() => {
							onClose()
							if (a.hidden) a.unhide()
							else onHide(a.hide())
						}}
						className={`mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${FOCUS} ${a.hidden ? "bg-pink-500/[0.12] ring-pink-400/50" : "bg-transparent ring-white/10 hover:bg-white/[0.06]"}`}
					>
						<NoSymbolIcon
							className="h-5 w-5 shrink-0 text-pink-300"
							aria-hidden
						/>
						<span className="min-w-0 flex-1 leading-tight">
							<span className="block text-sm font-bold text-gray-200">
								Not interested
							</span>
							<span className="block text-xs text-gray-400">
								{a.hidden
									? "Hidden from your recommendations. Press to bring it back."
									: "Hide it from your recommendations"}
							</span>
						</span>
					</button>
				)}
			</div>
		)
	} else {
		body = (
			<StatusMenu
				view={view}
				actions={actions}
				onRewatch={a.toggleWant}
				onDone={onClose}
			/>
		)
	}

	return (
		<>
			{anchor && (
				<Popout
					anchor={anchor}
					label={`Status of ${media.details.title}`}
					onClose={onClose}
				>
					{body}
				</Popout>
			)}
			<TrackingToastHost tracking={tracking} actions={actions} />
		</>
	)
}

function MenuRow({
	label,
	note,
	onClick,
}: { label: string; note: string; onClick: () => void }) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			className={`flex min-h-11 w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/10 ${FOCUS}`}
		>
			<span className="text-sm font-semibold text-white">{label}</span>
			<span className="text-xs text-gray-400">{note}</span>
		</button>
	)
}

/**
 * A menu beside the button that opened it: below it, or above when there's no room, kept on screen. Over the page
 * and the card's other layers; closes on Escape (the focus goes back to the button) and on a press outside it.
 */
function Popout({
	anchor,
	label,
	onClose,
	children,
}: {
	anchor: HTMLElement
	label: string
	onClose: () => void
	children: ReactNode
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [at, setAt] = useState<{ left: number; top: number } | null>(null)
	const place = useCallback(() => {
		const el = panel.current
		if (!el) return
		const r = anchor.getBoundingClientRect()
		const left = Math.max(
			8,
			Math.min(r.left, window.innerWidth - el.offsetWidth - 8),
		)
		let top = r.bottom + 6
		if (top + el.offsetHeight > window.innerHeight - 8)
			top = Math.max(8, r.top - el.offsetHeight - 6)
		setAt({ left, top })
	}, [anchor])
	useLayoutEffect(() => {
		place()
		const focusable = panel.current?.querySelector<HTMLElement>("button")
		if (!panel.current?.contains(document.activeElement))
			focusable?.focus({ preventScroll: true })
	}, [place])
	const latest = useRef(onClose)
	latest.current = onClose
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.stopPropagation()
			latest.current()
			anchor.focus({ preventScroll: true })
		}
		const away = (event: PointerEvent) => {
			const target = event.target as Node
			if (anchor.contains(target) || panel.current?.contains(target)) return
			latest.current()
		}
		// A panel that grows (the episode picker) is placed again.
		const observer = new ResizeObserver(place)
		if (panel.current) observer.observe(panel.current)
		window.addEventListener("keydown", onKey, true)
		document.addEventListener("pointerdown", away, true)
		window.addEventListener("scroll", place, true)
		window.addEventListener("resize", place)
		return () => {
			observer.disconnect()
			window.removeEventListener("keydown", onKey, true)
			document.removeEventListener("pointerdown", away, true)
			window.removeEventListener("scroll", place, true)
			window.removeEventListener("resize", place)
		}
	}, [anchor, place])
	return createPortal(
		<div
			ref={panel}
			data-card-popout=""
			// biome-ignore lint/a11y/useSemanticElements: a non-modal panel beside its button, not a <dialog>.
			role="dialog"
			aria-label={label}
			className={`fixed z-[1150] max-h-[calc(100vh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto text-white ${POPOVER}`}
			style={{ left: at?.left ?? -9999, top: at?.top ?? 0 }}
		>
			{children}
		</div>,
		document.body,
	)
}
