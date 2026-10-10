// What a press of a movie's Seen button does while REC_TRACKING is on, loaded at the first press:
// - a movie that is not Seen gets a watch for now, and a toast offers "Change date" and Undo;
// - a movie that is Seen opens its watch log, in a popover beside the button, or in a sheet on phones.
// Pressing Seen again never removes a watch: watches are removed in the log.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useQueryClient } from "@tanstack/react-query"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { newWatch, withWatch, withoutWatch } from "~/domain/watch-log"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import Drawer from "~/ui/modal/Drawer"
import { UndoToast } from "~/ui/title-actions/UndoToast"
import type { UserData } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { WatchLog } from "./WatchLog"
import type { SeenPress } from "./WatchLogHost"
import { newWatchId, useWatchLogAction } from "./useWatchLog"

interface OpenLog {
	movie: SeenPress["movie"]
	anchor: HTMLElement | null
	/** The watch whose date editor is open from the start. */
	editing: string | null
}

interface Toast {
	id: number
	text: string
	action?: string
	undo: () => void
	onAction?: () => void
}

export default function WatchLogSurface({ press }: { press: SeenPress }) {
	const client = useQueryClient()
	const { user } = useUser()
	const act = useWatchLogAction()
	const [open, setOpen] = useState<OpenLog | null>(null)
	const [toast, setToast] = useState<Toast | null>(null)
	const dismiss = useCallback(() => setToast(null), [])
	const say = useCallback(
		(text: string, undo: () => void) =>
			setToast({ id: Date.now(), text, undo }),
		[],
	)

	/** One tap: a watch for now. The toast can change its date or take it back. */
	const watchNow = useCallback(
		async ({ movie, anchor }: SeenPress) => {
			const { tmdbId, title } = movie
			const key = `movie-${tmdbId}` as const
			const before = client.getQueryData<UserData>(
				getQueryKeyUserData(user?.id),
			)
			const back = {
				wishlist: before?.wishlist[key],
				notInterested: before?.notInterested[key],
			}
			const scored = Boolean(before && key in before.scores)
			const id = newWatchId()
			const saved = await act(
				tmdbId,
				{ type: "watch", watchId: id },
				(log) => withWatch(log, newWatch(id, { precision: "moment" }, new Date())),
				{ watched: true },
			)
			if (!saved) return
			setToast({
				id: Date.now(),
				text: `${title} is Seen, watched just now`,
				action: "Change date",
				onAction: () => setOpen({ movie, anchor, editing: id }),
				undo: () =>
					void act(
						tmdbId,
						{
							type: "delete",
							watchId: id,
							back: {
								wantToSeeAddedAt: back.wishlist
									? new Date(back.wishlist.createdAt).toISOString()
									: null,
								notInterested: Boolean(back.notInterested),
							},
						},
						(log) =>
							withoutWatch(log, id, {
								movieId: tmdbId,
								scored,
								now: new Date(),
							}),
						{ back },
					),
			})
		},
		[act, client, user?.id],
	)

	// Each press once. Pressing the button of the open log closes it.
	const handled = useRef(0)
	useEffect(() => {
		if (handled.current === press.id) return
		handled.current = press.id
		if (!press.seen) {
			setOpen(null)
			void watchNow(press)
			return
		}
		setOpen((current) =>
			current && current.movie.tmdbId === press.movie.tmdbId && !current.editing
				? null
				: { movie: press.movie, anchor: press.anchor, editing: null },
		)
	}, [press, watchNow])

	const opened = useRef(open)
	opened.current = open
	const close = useCallback((refocus: boolean) => {
		const anchor = opened.current?.anchor
		setOpen(null)
		if (refocus && anchor?.isConnected) anchor.focus()
	}, [])

	return (
		<>
			<Flyout open={open} onClose={close}>
				{open && (
					<>
						<div className="mb-2 flex items-start gap-2">
							<div className="min-w-0 grow">
								<h3 className="truncate text-sm font-bold text-white">
									{open.movie.title}
								</h3>
								<p className="text-xs text-gray-400">Your watches</p>
							</div>
							<button
								type="button"
								onClick={() => close(true)}
								aria-label="Close the watch log"
								className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
							>
								<XMarkIcon className="h-5 w-5" aria-hidden />
							</button>
						</div>
						<WatchLog
							key={`${open.movie.tmdbId}-${open.editing ?? ""}`}
							movie={open.movie}
							editing={open.editing}
							say={say}
						/>
					</>
				)}
			</Flyout>
			{createPortal(
				<UndoToast
					toast={toast}
					onDismiss={dismiss}
					onAction={() => {
						toast?.onAction?.()
						setToast(null)
					}}
					onUndo={() => {
						toast?.undo()
						setToast(null)
					}}
				/>,
				document.body,
			)}
		</>
	)
}

function usePhone() {
	const [phone, setPhone] = useState(
		() => window.matchMedia("(max-width: 767px)").matches,
	)
	useEffect(() => {
		const media = window.matchMedia("(max-width: 767px)")
		const sync = () => setPhone(media.matches)
		sync()
		media.addEventListener("change", sync)
		return () => media.removeEventListener("change", sync)
	}, [])
	return phone
}

const WIDTH = 320
const EDGE = 8
const GAP = 8

/**
 * Where the log opens: a sheet on phones; from md up a popover under its button, above it when there is no room
 * below, and in the middle of the screen when the button is gone (a card that left its list). It renders at the end
 * of the page, so no scrolling row or card transform can clip it.
 */
function Flyout({
	open,
	onClose,
	children,
}: {
	open: OpenLog | null
	onClose: (refocus: boolean) => void
	children: ReactNode
}) {
	const phone = usePhone()
	const panel = useRef<HTMLDivElement>(null)
	const [at, setAt] = useState<{
		left: number
		top: number
		width: number
		fixed: boolean
	} | null>(null)
	const anchor = open?.anchor ?? null
	const popover = Boolean(open) && !phone

	useLayoutEffect(() => {
		if (!popover) return setAt(null)
		const place = () => {
			const height = panel.current?.offsetHeight ?? 0
			const width = Math.min(WIDTH, window.innerWidth - 2 * EDGE)
			if (!anchor?.isConnected)
				return setAt({
					left: (window.innerWidth - width) / 2,
					top: Math.max(EDGE, (window.innerHeight - height) / 2),
					width,
					fixed: true,
				})
			const button = anchor.getBoundingClientRect()
			const left = Math.max(
				EDGE,
				Math.min(button.left, window.innerWidth - width - EDGE),
			)
			const below = window.innerHeight - button.bottom - GAP - EDGE
			const above = button.top - GAP - EDGE
			const top =
				height <= below || below >= above
					? button.bottom + GAP
					: Math.max(EDGE, button.top - GAP - height)
			setAt({
				left: left + window.scrollX,
				top: top + window.scrollY,
				width,
				fixed: false,
			})
		}
		place()
		// The panel grows when a date editor opens.
		const resized = new ResizeObserver(place)
		if (panel.current) resized.observe(panel.current)
		window.addEventListener("resize", place)
		return () => {
			resized.disconnect()
			window.removeEventListener("resize", place)
		}
	}, [popover, anchor])

	// The focus moves into the popover once it has its place: before that it is hidden and can't take it.
	const placed = at !== null
	useEffect(() => {
		if (placed) panel.current?.focus({ preventScroll: true })
	}, [placed])

	useEffect(() => {
		if (!popover) return
		const onDown = (event: MouseEvent) => {
			const target = event.target as Element
			// The button closes its log through its own press, and the toast belongs to the log.
			if (panel.current?.contains(target) || anchor?.contains(target)) return
			if (target.closest?.("[data-toast]")) return
			onClose(false)
		}
		const onKey = (event: KeyboardEvent) =>
			event.key === "Escape" && onClose(true)
		document.addEventListener("mousedown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [popover, anchor, onClose])

	if (phone)
		return (
			<Drawer open={Boolean(open)} onClose={() => onClose(false)} allSizes>
				<div className="mx-auto max-w-md p-1 text-white" data-watch-log-sheet>
					{children}
				</div>
			</Drawer>
		)
	if (!open) return null
	return createPortal(
		<div
			ref={panel}
			// biome-ignore lint/a11y/useSemanticElements: a non-modal popover beside its button, not a <dialog>.
			role="dialog"
			aria-label={`Your watches of ${open.movie.title}`}
			tabIndex={-1}
			className={`${at?.fixed ? "fixed" : "absolute"} z-[90] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-stone-900 p-4 text-left text-white shadow-2xl shadow-black/70 outline-none`}
			style={
				at
					? { left: at.left, top: at.top, width: at.width }
					: { left: 0, top: 0, width: WIDTH, visibility: "hidden" }
			}
			data-watch-log-popover
		>
			{children}
		</div>,
		document.body,
	)
}
