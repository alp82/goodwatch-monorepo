// A movie's watch log: the member's watches newest first with the undated ones below, and what is done to them
// there. A watch's date is changed to a day or to "don't know when", a watch is deleted at once with Undo,
// "Watched it again" adds one, and "Remove all N watches" at the foot asks once, in place.
//
// A movie that is Seen through its score alone has no watch the member logged: the log says so and offers
// "I watched it". Clearing the score is done at the score control.
import {
	ArrowDownTrayIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import {
	type LoggedWhen,
	type WatchLogEntry,
	type WatchWhen,
	dayOf,
	memberWatches,
	newWatch,
	scoredOnly,
	sourceName,
	watchLabel,
	whenText,
	withDate,
	withRestored,
	withWatch,
	withoutWatch,
} from "~/domain/watch-log"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import type { RestoredEntry } from "~/server/watch-log.server"
import { DateChoice, optionOf } from "./DateChoice"
import { newWatchId, useWatchLog, useWatchLogAction } from "./useWatchLog"

const ICON_BUTTON =
	"inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
const QUIET_BUTTON =
	"inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"

// The icon library's pencil, drawn here. Every icon taken from the library joins the scripts of every page, and
// the others the log uses are there already; the pencil would be new.
const PencilIcon = ({ className }: { className: string }) => (
	<svg
		viewBox="0 0 20 20"
		fill="currentColor"
		className={className}
		aria-hidden="true"
	>
		<path d="m2.695 14.762-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
	</svg>
)

/** The rows Undo sends back: what the log showed, without the import's name, which the server reads itself. */
const restorable = (rows: WatchLogEntry[]): RestoredEntry[] =>
	memberWatches(rows).map(({ source: _, origin, ...row }) => ({
		...row,
		origin: origin === "import" ? "import" : "single",
	}))

export function WatchLog({
	movie,
	editing,
	say,
}: {
	movie: { tmdbId: number; title: string }
	/** A watch to open in the date editor, for "Change date" after a press. */
	editing: string | null
	/** Shows the toast with Undo. */
	say: (text: string, undo: () => void) => void
}) {
	const { tmdbId, title } = movie
	const log = useWatchLog(tmdbId)
	const act = useWatchLogAction()
	const scored = useUserScore("movie", tmdbId) !== null
	const [editId, setEditId] = useState<string | null>(editing)
	const [adding, setAdding] = useState(false)
	const [confirming, setConfirming] = useState(false)
	useEffect(() => setEditId(editing), [editing])

	if (log.isPending)
		return (
			<p className="py-3 text-sm text-gray-400" aria-live="polite">
				Loading your watches…
			</p>
		)
	if (log.isError || !log.data)
		return (
			<div className="py-2" role="alert">
				<p className="text-sm text-gray-300">Couldn't load your watches.</p>
				<button
					type="button"
					onClick={() => log.refetch()}
					className={`mt-2 ${QUIET_BUTTON}`}
				>
					Try again
				</button>
			</div>
		)

	const watches = log.data
	const mine = memberWatches(watches)
	const now = new Date()
	const settled = { movieId: tmdbId, scored, now }

	const add = (when: WatchWhen) => {
		setAdding(false)
		const id = newWatchId()
		void act(
			tmdbId,
			{ type: "watch", watchId: id, when },
			(before) => withWatch(before, newWatch(id, when, new Date())),
			{ watched: true },
		)
	}
	const restore = (rows: WatchLogEntry[]) => () =>
		void act(tmdbId, { type: "restore", rows: restorable(rows) }, (before) =>
			withRestored(before, rows),
		)
	const remove = async (watch: WatchLogEntry) => {
		setEditId(null)
		const saved = await act(
			tmdbId,
			{ type: "delete", watchId: watch.id },
			(before) => withoutWatch(before, watch.id, settled),
		)
		if (saved)
			say(`Removed the watch ${whenText(watch, new Date())}`, restore([watch]))
	}
	const removeAll = async () => {
		setConfirming(false)
		setEditId(null)
		const saved = await act(tmdbId, { type: "removeAll" }, (before) =>
			withoutWatch(before, null, settled),
		)
		if (saved) say(`Removed ${mine.length} watches of ${title}`, restore(mine))
	}
	const firstUndated = watches.findIndex((watch) => watch.at === null)

	return (
		<div data-watch-log={tmdbId}>
			{scoredOnly(watches) ? (
				<div className="py-1.5" data-watch="score">
					<p className="text-sm font-medium italic text-gray-300">
						Scored, no watch logged
					</p>
					<p className="mt-0.5 text-xs text-gray-400">
						It counts as Seen because you rated it.
					</p>
				</div>
			) : watches.length === 0 ? (
				<p className="py-2 text-sm text-gray-400">
					No watches. {title} is not marked as Seen.
				</p>
			) : (
				<ul>
					{watches.map((watch, index) => {
						const label = watchLabel(watch, now)
						const when = whenText(watch, now)
						return (
							<li
								key={watch.id}
								className={`py-1.5 ${index === 0 ? "" : index === firstUndated ? "border-t border-dashed border-white/15" : "border-t border-white/5"}`}
								data-watch={watch.precision}
							>
								<div className="flex items-center gap-2">
									<div className="min-w-0 grow">
										<p className="text-sm">
											<span
												className={
													watch.at === null
														? "font-medium italic text-gray-400"
														: "font-semibold text-white"
												}
											>
												{label.day}
											</span>
											{label.time && (
												<span className="ml-1.5 tabular-nums text-gray-400">
													{label.time}
												</span>
											)}
										</p>
										{watch.origin === "import" && (
											<p className="mt-0.5 flex items-center gap-1 text-xs text-sky-300/90">
												<ArrowDownTrayIcon className="h-3 w-3" aria-hidden />
												{sourceName(watch.source)
													? `Imported from ${sourceName(watch.source)}`
													: "Imported"}
											</p>
										)}
									</div>
									<button
										type="button"
										onClick={() =>
											setEditId(editId === watch.id ? null : watch.id)
										}
										aria-expanded={editId === watch.id}
										aria-label={`Change the date of the watch ${when}`}
										title="Change the date"
										className={`${ICON_BUTTON} ${editId === watch.id ? "bg-white/10 text-white" : ""}`}
										data-edit
									>
										<PencilIcon className="h-4 w-4" />
									</button>
									<button
										type="button"
										onClick={() => void remove(watch)}
										aria-label={`Delete the watch ${when}`}
										title="Delete this watch"
										className={ICON_BUTTON}
										data-delete
									>
										<TrashIcon className="h-4 w-4" aria-hidden />
									</button>
								</div>
								{editId === watch.id && (
									<div className="mb-1 mt-2 rounded-lg bg-black/30 p-2">
										<p className="mb-2 text-xs text-gray-400">
											When did you watch it?
										</p>
										<DateChoice
											options={["today", "yesterday", "day", "unknown"]}
											chosen={optionOf(watch, now)}
											startDay={dayOf(watch)}
											onPick={(picked) => {
												setEditId(null)
												const day = picked as LoggedWhen
												void act(
													tmdbId,
													{ type: "editDate", watchId: watch.id, when: day },
													(before) => withDate(before, watch.id, day),
												)
											}}
										/>
									</div>
								)}
							</li>
						)
					})}
				</ul>
			)}
			{adding ? (
				<div className="mt-2 rounded-lg bg-black/30 p-2">
					<p className="mb-2 text-xs text-gray-400">
						{mine.length ? "When did you watch it again?" : "When did you watch it?"}
					</p>
					<DateChoice
						options={
							mine.length
								? ["now", "yesterday", "day", "unknown"]
								: ["now", "day", "unknown"]
						}
						onPick={add}
					/>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className={`mt-2 ${QUIET_BUTTON}`}
					data-add
				>
					<PlusIcon className="h-4 w-4" aria-hidden />
					{mine.length ? "Watched it again" : "I watched it"}
				</button>
			)}
			{mine.length > 1 &&
				(confirming ? (
					<div
						className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 p-3"
						role="alert"
						data-confirm
					>
						<p className="text-sm text-gray-100">
							Remove all {mine.length} watches of {title}?{" "}
							{scored
								? "It stays Seen because you rated it."
								: "It will no longer be Seen."}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => void removeAll()}
								className="h-9 cursor-pointer rounded-lg bg-red-500 px-3 text-sm font-bold text-white hover:bg-red-400"
							>
								Remove {mine.length} watches
							</button>
							<button
								type="button"
								onClick={() => setConfirming(false)}
								className={QUIET_BUTTON}
							>
								Keep them
							</button>
						</div>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setConfirming(true)}
						className="mt-3 block cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
						data-remove-all
					>
						Remove all {mine.length} watches
					</button>
				))}
		</div>
	)
}
