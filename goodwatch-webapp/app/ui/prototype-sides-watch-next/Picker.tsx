// PROTOTYPE - throwaway (#659). Variant "picker": "Which side of you tonight?" above the hero. Picking a side makes it
// one more condition, like a mood: the hero, Then, and the first steps come from that side, in personal order; the
// titles of other sides that fit everything else follow in their own step. The side's moods are one tap away, for
// those who'd rather narrow by mood (what a side opens from the Taste page).
import { WRAP } from "~/ui/watch-next/style"
import { MoodButton, SideFaces, pct, useParam } from "./bits"
import type { SwnView } from "./model"

export function Picker({ view }: { view: SwnView }) {
	const set = useParam()
	if (!view.sides.length) return null
	const picked = view.sides.find((s) => s.id === view.side) ?? null
	const tile = (on: boolean) =>
		`flex shrink-0 cursor-pointer items-center gap-3 rounded-xl p-2.5 pr-4 text-left ring-1 transition-colors ${on ? "bg-white text-black ring-white" : "bg-white/[0.05] text-white ring-white/10 hover:ring-white/30"}`
	return (
		<section aria-label="Which side of you tonight?" className={`${WRAP} pb-2 pt-2`}>
			<p className="mb-2 text-sm font-semibold text-gray-300">Which side of you tonight?</p>
			<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="radiogroup">
				<button
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: a tile row, as the sort drawer's
					role="radio"
					aria-checked={!picked}
					onClick={() => set({ side: null, nt: null })}
					className={`${tile(!picked)} min-h-14`}
				>
					<span className="text-sm font-bold">Any side</span>
				</button>
				{view.sides.map((side, i) => {
					const on = picked?.id === side.id
					return (
						<button
							key={side.id}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: a tile row, as the sort drawer's
							role="radio"
							aria-checked={on}
							onClick={() => set({ side: on ? null : side.id, nt: null })}
							className={tile(on)}
							style={{ boxShadow: `inset 0 -3px 0 ${side.color}` }}
						>
							<SideFaces side={side} view={view} size="sm" />
							<span className="min-w-0">
								<span className="block max-w-56 truncate text-sm font-bold">{view.names ? side.name : `Side ${i + 1}`}</span>
								<span className={`block text-xs ${on ? "text-gray-700" : "text-gray-400"}`}>
									{side.fitting} fit tonight · {pct(side.share)} of what you love
								</span>
							</span>
						</button>
					)
				})}
			</div>
			{picked && picked.moods.length > 0 && (
				<p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
					Or narrow by mood instead: <MoodButton side={picked} />
				</p>
			)}
		</section>
	)
}
