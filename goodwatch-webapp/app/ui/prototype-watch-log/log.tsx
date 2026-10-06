// PROTOTYPE - throwaway. The watch log itself: the list of a film's watches with edit and delete, the date choice, and
// the flyout (a popover from md up, a sheet on phones) that some variants put it in.
import { ArrowDownTrayIcon, PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import Drawer from "~/ui/modal/Drawer"
import { type Film, type Watch, type When, dateLabel, daysAgo, ordered, today, whenText } from "./model"
import { useStore } from "./store"

export function usePhone() {
	const [phone, setPhone] = useState(false)
	useEffect(() => {
		const media = window.matchMedia("(max-width: 767px)")
		const sync = () => setPhone(media.matches)
		sync()
		media.addEventListener("change", sync)
		return () => media.removeEventListener("change", sync)
	}, [])
	return phone
}

const CHIP =
	"inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
const CHIP_ON = "bg-green-500 text-black"

export type DateOption = "now" | "today" | "yesterday" | "day" | "unknown"
const OPTION_LABEL: Record<DateOption, string> = { now: "Just now", today: "Today", yesterday: "Yesterday", day: "Another day", unknown: "Don't know when" }

/** Which option a watch's date corresponds to, to show it as chosen. */
export function optionOf(watch: Watch | undefined): DateOption | undefined {
	if (!watch) return undefined
	if (watch.precision === "unknown") return "unknown"
	if (watch.precision === "moment") return "now"
	return watch.at === today() ? "today" : watch.at === daysAgo(1) ? "yesterday" : "day"
}

/**
 * The date choice as a row of chips. "Another day" opens the browser's own date field in place, so there is no
 * calendar of ours and no dialog.
 */
export function DateChips({
	options,
	chosen,
	chosenDay,
	onPick,
}: {
	options: DateOption[]
	chosen?: DateOption
	/** The day to start the date field on. */
	chosenDay?: string
	onPick: (when: When) => void
}) {
	const [picking, setPicking] = useState(false)
	const [day, setDay] = useState(chosenDay ?? daysAgo(1))
	const pick = (option: DateOption) => {
		if (option === "day") return setPicking(!picking)
		setPicking(false)
		if (option === "now") onPick({ precision: "moment" })
		else if (option === "unknown") onPick({ precision: "unknown" })
		else onPick({ precision: "day", day: option === "today" ? today() : daysAgo(1) })
	}
	return (
		<div data-date-chips>
			<div className="flex flex-wrap gap-1.5">
				{options.map((option) => (
					<button
						key={option}
						type="button"
						aria-pressed={chosen === option && !picking}
						onClick={() => pick(option)}
						data-option={option}
						className={`${CHIP} ${(chosen === option && !picking) || (option === "day" && picking) ? CHIP_ON : CHIP_OFF}`}
					>
						{OPTION_LABEL[option]}
					</button>
				))}
			</div>
			{picking && (
				<form
					className="mt-2 flex items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault()
						if (!day) return
						setPicking(false)
						onPick({ precision: "day", day })
					}}
				>
					<input
						type="date"
						value={day}
						max={today()}
						onChange={(event) => setDay(event.target.value)}
						aria-label="The day you watched it"
						className="h-10 min-w-0 grow rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white [color-scheme:dark]"
					/>
					<button type="submit" className="h-10 shrink-0 cursor-pointer rounded-lg bg-green-500 px-4 text-sm font-bold text-black hover:bg-green-400">
						Save
					</button>
				</form>
			)}
		</div>
	)
}

const ICON_BUTTON =
	"inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"

/**
 * A film's watches. A watch with a time shows it, a watch with only a day shows the day, a watch without a date says
 * so. An imported watch names its source; a watch marked by hand has no badge.
 */
export function WatchLog({
	film,
	canAdd = false,
	canRemoveAll = false,
	editing,
	confirmAtStart = false,
	className = "",
}: {
	film: Film
	canAdd?: boolean
	canRemoveAll?: boolean
	/** Open with the question about removing all watches. */
	confirmAtStart?: boolean
	/** A watch to open in the editor from the start. */
	editing?: string
	className?: string
}) {
	const s = useStore()
	const watches = ordered(s.of(film.id), s.order)
	const [editId, setEditId] = useState<string | null>(editing ?? null)
	const [adding, setAdding] = useState(false)
	const [confirming, setConfirming] = useState(confirmAtStart)
	useEffect(() => setEditId(editing ?? null), [editing])
	const firstUndated = s.order === "dated" ? watches.findIndex((watch) => watch.at == null) : -1
	return (
		<div className={className} data-watch-log={film.id}>
			{watches.length === 0 ? (
				<p className="py-2 text-sm text-gray-400">No watches yet.</p>
			) : (
				<ul>
					{watches.map((watch, index) => {
						const label = dateLabel(watch)
						return (
							<li key={watch.id} className={`py-1.5 ${index === firstUndated && index > 0 ? "border-t border-dashed border-white/15" : index > 0 ? "border-t border-white/5" : ""}`} data-watch={watch.precision}>
								<div className="flex items-center gap-2">
									<div className="min-w-0 grow">
										<p className="text-sm">
											<span className={watch.at == null ? "font-medium italic text-gray-400" : "font-semibold text-white"}>{label.day}</span>
											{label.time && <span className="ml-1.5 tabular-nums text-gray-400">{label.time}</span>}
										</p>
										{watch.origin === "import" && (
											<p className="mt-0.5 flex items-center gap-1 text-xs text-sky-300/90">
												<ArrowDownTrayIcon className="h-3 w-3" aria-hidden />
												Imported from {watch.source}
											</p>
										)}
									</div>
									<button
										type="button"
										onClick={() => setEditId(editId === watch.id ? null : watch.id)}
										aria-expanded={editId === watch.id}
										aria-label={`Change the date of the watch ${whenText(watch)}`}
										title="Change the date"
										className={`${ICON_BUTTON} ${editId === watch.id ? "bg-white/10 text-white" : ""}`}
										data-edit
									>
										<PencilIcon className="h-4 w-4" />
									</button>
									<button
										type="button"
										onClick={() => {
											s.removeOne(film.id, watch.id)
											s.say(`Removed the watch ${whenText(watch)}`, { undo: true })
										}}
										aria-label={`Delete the watch ${whenText(watch)}`}
										title="Delete this watch"
										className={ICON_BUTTON}
										data-delete
									>
										<TrashIcon className="h-4 w-4" />
									</button>
								</div>
								{editId === watch.id && (
									<div className="mb-1 mt-2 rounded-lg bg-black/30 p-2">
										<p className="mb-2 text-xs text-gray-400">When did you watch it?</p>
										<DateChips
											options={["today", "yesterday", "day", "unknown"]}
											chosen={optionOf(watch) === "now" ? undefined : optionOf(watch)}
											chosenDay={watch.at ? watch.at.slice(0, 10) : undefined}
											onPick={(when) => {
												s.update(film.id, watch.id, when)
												setEditId(null)
											}}
										/>
									</div>
								)}
							</li>
						)
					})}
				</ul>
			)}
			{canAdd &&
				(adding ? (
					<div className="mt-2 rounded-lg bg-black/30 p-2">
						<p className="mb-2 text-xs text-gray-400">{watches.length ? "When did you watch it again?" : "When did you watch it?"}</p>
						<DateChips
							options={["now", "yesterday", "day", "unknown"]}
							onPick={(when) => {
								s.add(film.id, when)
								setAdding(false)
							}}
						/>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="mt-2 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20"
						data-add
					>
						<PlusIcon className="h-4 w-4" />
						{watches.length ? "Watched it again" : "Add a watch"}
					</button>
				))}
			{canRemoveAll &&
				watches.length > 1 &&
				(confirming ? (
					<RemoveAllConfirm film={film} onDone={() => setConfirming(false)} />
				) : (
					<button type="button" onClick={() => setConfirming(true)} className="mt-3 block cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white" data-remove-all>
						Remove all {watches.length} watches
					</button>
				))}
		</div>
	)
}

/** The confirmation that names the count. In the page, not a dialog. */
export function RemoveAllConfirm({ film, onDone }: { film: Film; onDone: () => void }) {
	const s = useStore()
	const count = s.of(film.id).length
	return (
		<div className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 p-3" role="alert" data-confirm>
			<p className="text-sm text-gray-100">
				Remove all {count} watches of {film.title}? It will no longer be Seen.
			</p>
			<div className="mt-2 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => {
						s.removeAll(film.id)
						s.say(`Removed ${count} watches of ${film.title}`, { undo: true })
						onDone()
					}}
					className="h-9 cursor-pointer rounded-lg bg-red-500 px-3 text-sm font-bold text-white hover:bg-red-400"
				>
					Remove {count} watches
				</button>
				<button type="button" onClick={onDone} className="h-9 cursor-pointer rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20">
					Keep them
				</button>
			</div>
		</div>
	)
}

/**
 * Where a menu or the log opens: a popover under its opener from md up, a sheet on phones, or in place ("inline", for
 * content that already sits in a sheet).
 */
export function Flyout({
	open,
	onClose,
	inline = false,
	align = "left",
	children,
}: {
	open: boolean
	onClose: () => void
	inline?: boolean
	align?: "left" | "right"
	children: ReactNode
}) {
	const phone = usePhone()
	const panel = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open || inline || phone) return
		const onDown = (event: MouseEvent) => {
			// The opener sits in the same relative wrapper and closes the flyout through its own click.
			if (panel.current?.parentElement?.contains(event.target as Node)) return
			onClose()
		}
		const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
		document.addEventListener("mousedown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [open, inline, phone, onClose])
	if (inline) return open ? <div className="mt-2 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">{children}</div> : null
	if (phone)
		return (
			<Drawer open={open} onClose={onClose} allSizes>
				<div className="mx-auto max-w-md p-1 text-white">{open && children}</div>
			</Drawer>
		)
	if (!open) return null
	return (
		<div
			ref={panel}
			className={`absolute top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-stone-900 p-4 text-left text-white shadow-2xl shadow-black/70 ${align === "right" ? "right-0" : "left-0"}`}
			data-flyout
		>
			{children}
		</div>
	)
}
