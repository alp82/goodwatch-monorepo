// What My movies (#385) adds to the Watch next page it is drawn with: the page's head, and "How long?", the fourth
// choice of the control strip (a select on desktop, a button and a drawer on phones).
import { ChevronDownIcon, ClockIcon } from "@heroicons/react/20/solid"
import { TIME_CHOICES, timeLabel } from "~/domain/my-movies"
import { MY_LIBRARY, MY_SHOWS, PageHead, plural } from "~/ui/my-pages/bits"
import type { MoviesPageParts } from "~/ui/watch-next/movies-page"

const CHOICES: (number | null)[] = [null, ...TIME_CHOICES]

function TimeSelect({
	time,
	setTime,
}: { time: number | null; setTime: (time: number | null) => void }) {
	return (
		<label
			className={`relative flex h-9 shrink-0 items-center rounded-xl pl-3 text-sm font-bold ring-1 transition-colors focus-within:ring-2 focus-within:ring-amber-400 ${time ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:ring-white/20"}`}
		>
			<span className="sr-only">How long have you got?</span>
			<select
				value={time ?? ""}
				onChange={(event) =>
					setTime(event.target.value ? Number(event.target.value) : null)
				}
				data-time
				className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold outline-none"
			>
				{CHOICES.map((minutes) => (
					<option
						key={minutes ?? "any"}
						value={minutes ?? ""}
						className="bg-gray-900 text-gray-100"
					>
						{minutes === null ? "How long? Any length" : timeLabel(minutes)}
					</option>
				))}
			</select>
			<ChevronDownIcon
				className="pointer-events-none absolute right-2 h-4 w-4 opacity-70"
				aria-hidden
			/>
		</label>
	)
}

function TimeDrawer({
	time,
	setTime,
}: { time: number | null; setTime: (time: number | null) => void }) {
	return (
		<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How long?">
			{CHOICES.map((minutes) => {
				const on = minutes === time
				return (
					<button
						key={minutes ?? "any"}
						// biome-ignore lint/a11y/useSemanticElements: a tile grid, as the sort drawer's
						type="button"
						role="radio"
						aria-checked={on}
						data-time-choice={minutes ?? "any"}
						onClick={() => setTime(minutes)}
						className={`flex min-h-12 cursor-pointer items-center rounded-xl px-3 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white text-black" : "bg-white/[0.05] text-white ring-1 ring-white/10"}`}
					>
						{timeLabel(minutes)}
					</button>
				)
			})}
		</div>
	)
}

export const MOVIES_PAGE: MoviesPageParts = {
	head: (data) => (
		<PageHead
			name="My movies"
			line={
				data
					? data.total
						? `${plural(data.total, "movie")} you want to see`
						: "Want to See on a movie puts it here."
					: "The movies you want to see"
			}
			links={[
				{ label: "My shows", to: MY_SHOWS },
				{ label: "My library", to: MY_LIBRARY },
			]}
		/>
	),
	timeControl: (time, setTime) => <TimeSelect time={time} setTime={setTime} />,
	phoneTime: {
		label: (time) => (time === null ? "How long?" : timeLabel(time)),
		icon: (time) => (
			<ClockIcon
				className={`h-4 w-4 ${time === null ? "text-gray-400" : "text-amber-300"}`}
				aria-hidden
			/>
		),
		drawer: (time, setTime) => <TimeDrawer time={time} setTime={setTime} />,
	},
}
