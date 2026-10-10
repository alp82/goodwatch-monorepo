// The bar a score is given in from a row of My library (#385): one row of ten keys above the dock. It loads with the
// first press of a score or a Rate key. The page stores the score: this bar is gone before the answer comes.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef } from "react"
import type { LibraryItem } from "~/server/my-library.server"
import type { Score } from "~/server/scores.server"
import { Poster } from "~/ui/my-pages/bits"

const SCORES: Score[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function RateBar({
	item,
	score,
	onRated,
	onClose,
}: {
	item: LibraryItem
	/** The score the row shows now. */
	score: number | null
	onRated: (item: LibraryItem, score: Score | null) => void
	onClose: () => void
}) {
	const bar = useRef<HTMLElement>(null)
	// Focus moves into the bar, and Escape closes it.
	useEffect(() => {
		bar.current
			?.querySelector<HTMLButtonElement>("[aria-pressed=true], [data-give]")
			?.focus()
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])
	const give = (value: Score | null) => {
		onRated(item, value)
		onClose()
	}
	return (
		<section
			ref={bar}
			aria-label={`Your score for ${item.title}`}
			data-rate-bar
			className="fixed inset-x-2 bottom-[calc(var(--nav-dock-height,0px)+0.5rem)] z-[60] mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-gray-950 p-3 text-gray-100 shadow-2xl ring-1 ring-white/20 lg:bottom-6"
		>
			<div className="flex items-center gap-2">
				<Poster path={item.poster_path} className="h-12 w-8 shrink-0 rounded" />
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm">{item.title}</b>
					<span className="block text-xs text-gray-400">
						{score === null ? "Your score" : `Your score is ${score}`}
					</span>
				</span>
				{score !== null && (
					<button
						type="button"
						data-clear-score
						onClick={() => give(null)}
						className="h-11 cursor-pointer rounded-lg px-2 text-xs font-semibold text-gray-400 hover:bg-white/10 hover:text-white"
					>
						Clear
					</button>
				)}
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
				>
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div className="grid grid-cols-10 gap-1">
				{SCORES.map((n) => (
					<button
						key={n}
						type="button"
						data-give={n}
						aria-pressed={score === n}
						aria-label={`${n} out of 10`}
						onClick={() => give(n)}
						className={`h-11 cursor-pointer rounded-md text-sm font-black tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${score === n ? "bg-amber-400 text-black" : "bg-white/[0.08] text-gray-100 hover:bg-white/20"}`}
					>
						{n}
					</button>
				))}
			</div>
		</section>
	)
}
