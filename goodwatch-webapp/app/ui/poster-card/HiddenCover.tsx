// The poster card's Not interested cover: the poster stays where it was, greyed under a dark layer, with what happened
// and Undo. An S card has the icon and Undo; "Not interested" shows from M, "Off your picks" on L. The card shows it
// after Not interested from its actions, and from the start for a title already hidden (the Hidden titles page).
import { ArrowUturnLeftIcon, NoSymbolIcon } from "@heroicons/react/20/solid"
import { FOCUS } from "./look"

export function HiddenCover({
	title,
	onUndo,
	pending = false,
}: {
	title: string
	onUndo: () => void
	/** Undo was pressed and is on its way. */
	pending?: boolean
}) {
	return (
		<div
			data-hidden-cover=""
			className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-gray-950/65 px-1.5 text-center"
		>
			<span className="flex size-7 items-center justify-center rounded-full bg-gray-950/90 ring-1 ring-pink-300/40 @min-[6.5rem]/card:size-8 @min-[11rem]/card:size-10">
				<NoSymbolIcon
					className="size-4 text-pink-300 @min-[11rem]/card:size-5"
					aria-hidden
				/>
			</span>
			<p className="hidden text-xs font-bold leading-tight text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.8)] @min-[6.5rem]/card:block @min-[11rem]/card:text-sm">
				Not interested
			</p>
			<p className="-mt-1 hidden text-[11px] leading-tight text-gray-300 @min-[11rem]/card:block">
				Off your picks
			</p>
			<button
				type="button"
				onClick={onUndo}
				disabled={pending}
				aria-label={`Undo Not interested for ${title}`}
				className={`mt-0.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-[11px] font-bold text-gray-950 shadow-md shadow-black/50 hover:bg-gray-200 disabled:cursor-wait disabled:opacity-60 @min-[6.5rem]/card:h-7 @min-[6.5rem]/card:px-2.5 @min-[6.5rem]/card:text-xs @min-[11rem]/card:h-8 @min-[11rem]/card:px-3 ${FOCUS}`}
			>
				<ArrowUturnLeftIcon
					className="size-3.5 @min-[11rem]/card:size-4"
					aria-hidden
				/>
				Undo
			</button>
		</div>
	)
}
