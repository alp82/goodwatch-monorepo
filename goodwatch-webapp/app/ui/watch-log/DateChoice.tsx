// When a watch happened, as a row of chips: Just now, Today, Yesterday, Another day, Don't know when. "Another day"
// opens the browser's own date field in place, so there is no calendar of ours and no dialog. It never offers a time.
import { useState } from "react"
import {
	type WatchLogEntry,
	type WatchWhen,
	dayBefore,
	dayOf,
	localDay,
} from "~/domain/watch-log"

export type DateOption = "now" | "today" | "yesterday" | "day" | "unknown"

const LABEL: Record<DateOption, string> = {
	now: "Just now",
	today: "Today",
	yesterday: "Yesterday",
	day: "Another day",
	unknown: "Don't know when",
}

const CHIP =
	"inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
const CHIP_ON = "bg-green-500 text-black"

/** Which chip a watch's date is, to show it as chosen. A watch with a time is none of the days. */
export function optionOf(
	watch: WatchLogEntry | undefined,
	now: Date,
): DateOption | undefined {
	if (!watch) return undefined
	if (watch.precision === "unknown") return "unknown"
	if (watch.precision === "moment") return undefined
	const day = dayOf(watch)
	const today = localDay(now)
	return day === today
		? "today"
		: day === dayBefore(today)
			? "yesterday"
			: "day"
}

export function DateChoice({
	options,
	chosen,
	startDay,
	onPick,
}: {
	options: DateOption[]
	chosen?: DateOption
	/** The day the date field starts on. Yesterday without one. */
	startDay?: string | null
	onPick: (when: WatchWhen) => void
}) {
	const today = localDay(new Date())
	const [picking, setPicking] = useState(false)
	const [day, setDay] = useState(startDay ?? dayBefore(today))
	const pick = (option: DateOption) => {
		if (option === "day") return setPicking(!picking)
		setPicking(false)
		if (option === "now") onPick({ precision: "moment" })
		else if (option === "unknown") onPick({ precision: "unknown" })
		else
			onPick({
				precision: "day",
				day: option === "today" ? today : dayBefore(today),
			})
	}
	return (
		<div data-date-choice>
			<div className="flex flex-wrap gap-1.5">
				{options.map((option) => {
					const on =
						option === "day"
							? picking || chosen === "day"
							: chosen === option && !picking
					return (
						<button
							key={option}
							type="button"
							aria-pressed={option === "day" ? undefined : on}
							aria-expanded={option === "day" ? picking : undefined}
							onClick={() => pick(option)}
							data-option={option}
							className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
						>
							{LABEL[option]}
						</button>
					)
				})}
			</div>
			{picking && (
				<form
					className="mt-2 flex items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault()
						// The field stops at today; a day typed past it is not sent.
						if (!day || day > today) return
						setPicking(false)
						onPick({ precision: "day", day })
					}}
				>
					<input
						type="date"
						value={day}
						max={today}
						required
						onChange={(event) => setDay(event.target.value)}
						aria-label="The day you watched it"
						className="h-10 min-w-0 grow rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white [color-scheme:dark]"
					/>
					<button
						type="submit"
						className="h-10 shrink-0 cursor-pointer rounded-lg bg-green-500 px-4 text-sm font-bold text-black hover:bg-green-400"
					>
						Save
					</button>
				</form>
			)}
		</div>
	)
}
