// The date of a watch that was just recorded for now, as one line with "Change": "Watched today, 22:45. Change".
// Watch next's "I watched it" dialog shows it, because people clear their list after the fact. "Change" opens the
// date choice in place: a day or "don't know when".
import { useEffect, useState } from "react"
import {
	type LoggedWhen,
	type WatchLogEntry,
	dayOf,
	newWatch,
	whenText,
	withDate,
} from "~/domain/watch-log"
import { DateChoice, optionOf } from "./DateChoice"
import { useWatchLogAction } from "./useWatchLog"

export default function WatchedLine({
	movieId,
	watchId,
}: {
	movieId: number
	/** The id of the watch once the server recorded it; null when nothing was recorded. */
	watchId: Promise<string | null>
}) {
	const act = useWatchLogAction()
	const [watch, setWatch] = useState<WatchLogEntry | null>(null)
	const [changing, setChanging] = useState(false)
	useEffect(() => {
		let current = true
		const recorded = new Date()
		void watchId.then((id) => {
			if (current && id)
				setWatch(newWatch(id, { precision: "moment" }, recorded))
		})
		return () => {
			current = false
		}
	}, [watchId])
	// The movie was Seen already, or the watch is not recorded yet: there is no date to show or change.
	if (!watch) return null
	const now = new Date()
	const change = async (when: LoggedWhen) => {
		const before = watch
		setChanging(false)
		setWatch(withDate([watch], watch.id, when)[0])
		const saved = await act(
			movieId,
			{ type: "editDate", watchId: watch.id, when },
			(log) => withDate(log, watch.id, when),
		)
		if (!saved) setWatch(before)
	}
	return (
		<div className="mt-3" data-watched-line>
			<p className="text-sm text-gray-300">
				Watched {whenText(watch, now)}.{" "}
				<button
					type="button"
					onClick={() => setChanging(!changing)}
					aria-expanded={changing}
					className="cursor-pointer font-semibold text-white underline decoration-white/30 underline-offset-2"
				>
					Change
				</button>
			</p>
			{changing && (
				<div className="mt-2">
					<DateChoice
						options={
							watch.precision === "moment"
								? ["yesterday", "day", "unknown"]
								: ["today", "yesterday", "day", "unknown"]
						}
						chosen={optionOf(watch, now)}
						startDay={watch.precision === "day" ? dayOf(watch) : null}
						onPick={(when) => void change(when as LoggedWhen)}
					/>
				</div>
			)}
		</div>
	)
}
