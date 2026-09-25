// Search plus a poster grid that fills the remaining height. Without a query it shows the prompt's quick picks.
// Posters can be clicked to add or remove, or dragged into the ranking or onto the card.
import { useState } from "react"
import { Thumb } from "~/ui/share-list-editor/parts"
import type { Editor } from "~/ui/share-list-editor/useEditor"
import { useTitleSearch } from "~/ui/share-list-editor/useTitleSearch"

const GRID_LIMIT = 48

export function TitleGrid({ ed }: { ed: Editor }) {
	const [text, setText] = useState("")
	const { results, loading } = useTitleSearch(text)
	const { list, dnd } = ed
	const shown = (results ?? ed.quickPicks).slice(0, GRID_LIMIT)
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="relative shrink-0">
				<input
					type="search"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="Search movies and shows"
					aria-label="Search movies and shows"
					className="w-full rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
				/>
				{loading && (
					<div className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
				)}
			</div>
			{results && !results.length && !loading && (
				<div className="text-sm text-neutral-500">No matches</div>
			)}
			<div
				data-drag-scroll
				className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(84px,1fr))] content-start gap-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]"
			>
				{shown.map((title) => {
					const rank = list.items.findIndex((i) => i.key === title.key)
					return (
						<button
							key={title.key}
							type="button"
							onPointerDown={(e) =>
								dnd.start(e, { item: title, from: rank >= 0 ? rank : null })
							}
							onClick={() =>
								rank >= 0 ? list.remove(title.key) : list.add(title)
							}
							className="group relative cursor-grab touch-pan-y text-left select-none"
							title={title.title}
							aria-label={`${rank >= 0 ? "Remove" : "Add"} ${title.title}`}
						>
							<Thumb
								item={title}
								className={`w-full rounded-md transition ${rank >= 0 ? "opacity-30" : "group-hover:-translate-y-0.5"} ${dnd.drag?.payload.item.key === title.key ? "opacity-20" : ""}`}
							/>
							{rank >= 0 && (
								<span className="absolute inset-x-0 top-[28%] text-center text-2xl font-black">
									{rank + 1}
								</span>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}
