// What tracking says after an action, at the bottom of the screen: the message with its actions ("Set a date",
// Undo), and the small dialog that gives a group's watches a date. The hero box and the episode list both mount it;
// the first one mounted shows it. And what tracking asks before an action that removes watches or starts a pass:
// the question the status menu and the episode list show in place.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { type RefObject, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { TrackingActions } from "./actions"
import { FOCUS, type ShowTracking } from "./store"

export function TrackingToastHost({
	tracking,
	actions,
}: {
	tracking: ShowTracking
	actions: TrackingActions
}) {
	const { store, toast, dateRequest, today } = tracking
	const host = useRef({})
	useEffect(() => store.claimHost(host.current), [store])
	if (!store.isHost(host.current)) return null
	return createPortal(
		<>
			{toast && (
				<div
					className="pointer-events-none fixed inset-x-0 bottom-28 z-[1050] flex justify-center px-3 lg:bottom-6"
					aria-live="polite"
				>
					<div
						key={toast.id}
						data-tracking-toast={toast.tone}
						className={`pointer-events-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur ${
							toast.tone === "error"
								? "border-pink-400/40 bg-pink-950/95"
								: "border-white/10 bg-stone-900/95"
						}`}
					>
						<span className="min-w-0 flex-1 basis-40 py-1">{toast.text}</span>
						<span className="ml-auto flex shrink-0 items-center gap-2">
							{toast.actions.map((action) => (
								<button
									key={action.label}
									type="button"
									onClick={action.run}
									className={`shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1.5 font-semibold text-amber-300 hover:bg-white/20 ${FOCUS}`}
								>
									{action.label}
								</button>
							))}
							<button
								type="button"
								aria-label="Close"
								onClick={store.dismissToast}
								className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
							>
								<XMarkIcon className="h-4 w-4" />
							</button>
						</span>
					</div>
				</div>
			)}
			{dateRequest && (
				<DateDialog
					count={dateRequest.count}
					today={today}
					onClose={() => store.askDate(null)}
					onPick={(day) => {
						actions.setGroupDate(dateRequest.group, day)
						store.askDate(null)
					}}
				/>
			)}
		</>,
		document.body,
	)
}

/**
 * Closes what is open in place, a menu or a question: on a press outside `root`, and on Escape, which says so, so
 * that the caller can return the focus to what opened it.
 */
export function useDismiss(
	open: boolean,
	root: RefObject<HTMLElement | null>,
	close: (byKey: boolean) => void,
) {
	const latest = useRef(close)
	latest.current = close
	useEffect(() => {
		if (!open) return
		const onPress = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) latest.current(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") latest.current(true)
		}
		window.addEventListener("pointerdown", onPress)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointerdown", onPress)
			window.removeEventListener("keydown", onKey)
		}
	}, [open, root])
}

/** The surface of what opens in place over the page: the status menu, and a question outside it. */
export const POPOVER =
	"rounded-xl border border-white/10 bg-gray-900 p-1 shadow-2xl"

/** The button that goes on with taking a Seen press back. It removes watches, and the toast then offers Undo. */
export const TAKE_BACK_LOOK = "bg-white text-gray-950 hover:bg-gray-200"

/**
 * The question before an action that removes watches or starts a pass: what will happen, Cancel, and the action.
 * The status menu shows it in place of its entries, the episode list under the line it belongs to. Cancel has the
 * focus, so that Enter on a question that came by mistake changes nothing.
 */
export function ConfirmPanel({
	name,
	title,
	text,
	action,
	look,
	onConfirm,
	onCancel,
}: {
	/** Which question this is, for the page's own checks. */
	name: string
	title: string
	text: string
	/** The words on the button that goes on. */
	action: string
	/** The colours of that button. */
	look: string
	onConfirm: () => void
	onCancel: () => void
}) {
	const cancel = useRef<HTMLButtonElement>(null)
	useEffect(() => cancel.current?.focus({ preventScroll: true }), [])
	return (
		<div data-confirm={name} className="p-3">
			<p className="text-sm font-semibold text-white">{title}</p>
			<p className="mt-1 text-xs leading-5 text-gray-400">{text}</p>
			<div className="mt-3 flex justify-end gap-2">
				<button
					ref={cancel}
					type="button"
					data-confirm-cancel
					onClick={onCancel}
					className={`h-10 cursor-pointer rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
				>
					Cancel
				</button>
				<button
					type="button"
					data-confirm-yes
					onClick={onConfirm}
					className={`h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold ${look} ${FOCUS}`}
				>
					{action}
				</button>
			</div>
		</div>
	)
}

/** "Set a date" after Mark season, Watched up to here or the Seen press: today, or a day the member picks. */
function DateDialog({
	count,
	today,
	onPick,
	onClose,
}: {
	count: number
	today: string
	onPick: (day: string) => void
	onClose: () => void
}) {
	const [day, setDay] = useState(today)
	const panel = useRef<HTMLDivElement>(null)
	useEffect(() => {
		panel.current?.focus()
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])
	return (
		<div
			className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/70 sm:items-center"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<div
				ref={panel}
				// biome-ignore lint/a11y/useSemanticElements: a dialog element needs its own open and close calls; this one is rendered while it is open
				role="dialog"
				aria-modal="true"
				aria-label="Set a date"
				tabIndex={-1}
				className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-gray-900 p-5 text-white focus:outline-none sm:rounded-2xl"
			>
				<h3 className="text-lg font-bold">
					When did you watch{" "}
					{count === 1 ? "this episode" : `these ${count} episodes`}?
				</h3>
				<p className="mt-1 text-sm text-gray-400">
					All of them get the day you pick. Without one they stay watched with
					no date.
				</p>
				<label className="mt-4 flex items-center gap-3 text-sm font-semibold">
					On
					<input
						type="date"
						max={today}
						value={day}
						onChange={(event) => setDay(event.target.value)}
						className="h-11 flex-1 rounded-lg bg-black/40 px-3 text-base text-white [color-scheme:dark]"
					/>
				</label>
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className={`h-11 cursor-pointer rounded-lg bg-white/10 px-4 text-sm font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
					>
						Keep no date
					</button>
					<button
						type="button"
						disabled={!day || day > today}
						onClick={() => onPick(day)}
						className={`h-11 cursor-pointer rounded-lg bg-green-500 px-4 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
					>
						Set date
					</button>
				</div>
			</div>
		</div>
	)
}
