// The card's three Loved slots, under a small "Loved n/3" label: quiet frames that take the loved posters. A filled
// slot undoes that title.
import type { TitleCard } from "~/server/title-cards.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { LOVED_NEEDED } from "../stage/start-query"

export function LovedSlots({
	loved,
	onUndo,
}: {
	loved: readonly TitleCard[]
	onUndo: (card: TitleCard) => void
}) {
	return (
		<div className="flex shrink-0 flex-col items-center gap-1">
			<span className="sr-only" aria-live="polite">
				{loved.length} of {LOVED_NEEDED} loved
			</span>
			<span
				aria-hidden
				className="text-[10px] font-bold uppercase leading-3 tracking-[0.14em] text-gray-400 sm:text-[11px]"
			>
				Loved{" "}
				<span className="tabular-nums text-gray-500">
					{loved.length}/{LOVED_NEEDED}
				</span>
			</span>
			<div className="flex gap-1.5 sm:gap-2">
				{Array.from({ length: LOVED_NEEDED }, (_, i) => {
					const card = loved[i]
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: the slots are places
							key={i}
							className={`spotlight-slot relative block aspect-[2/3] shrink-0 rounded-[5px] ${card ? "" : "bg-white/[0.05] ring-1 ring-inset ring-white/[0.12]"}`}
						>
							{card ? (
								<button
									key={card.key}
									type="button"
									onClick={() => onUndo(card)}
									aria-label={`Remove ${card.title}`}
									className="spotlight-drop absolute inset-0 cursor-pointer overflow-hidden rounded-[5px] border-2 border-amber-400 shadow-[0_4px_14px_rgb(251_191_36/.3)] outline-none focus-visible:ring-2 focus-visible:ring-white"
								>
									{card.poster_path ? (
										<img
											src={tmdbImageUrl(card.poster_path, "w92")}
											alt=""
											className="absolute inset-0 h-full w-full object-cover"
										/>
									) : null}
								</button>
							) : null}
						</span>
					)
				})}
			</div>
		</div>
	)
}
