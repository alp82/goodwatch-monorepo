// PROTOTYPE (discover-easy) A "Feelings": under the search, example searches and the start page's eight mixes as
// picture tiles. After a choice the tiles shrink to a strip, so the readout and the results lead.
import { START_PRESETS } from "~/ui/start/search/presets"
import { type EasyContext, MIXES, activeMix, backdrop, hasChoice, usePictures, wordHue, wordsPatch } from "./kit"
import { useInterpretedSearch } from "./ProtoSearch"

export const name = "Feelings"

export function VariantA({ ctx }: { ctx: EasyContext }) {
	const pictures = usePictures()
	const { run } = useInterpretedSearch()
	const chosen = hasChoice(ctx)
	const mix = activeMix(ctx.filters.state)
	return (
		<section className="mt-5">
			{!chosen && (
				<div className="mb-5 flex flex-wrap items-center gap-2">
					<span className="mr-1 text-sm text-gray-500">Try</span>
					{["funny 90s movies on netflix", ...START_PRESETS.slice(0, 5)].map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => run(p)}
							className="cursor-pointer rounded-full bg-white/[0.05] px-3.5 py-1.5 text-sm text-gray-200 ring-1 ring-white/10 hover:bg-white/[0.1] hover:text-white"
						>
							{p}
						</button>
					))}
				</div>
			)}
			{!chosen && <p className="mb-3 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">Or start with a feeling</p>}
			<div className={`-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 ${chosen ? "" : "lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"}`}>
				{MIXES.map((m) => {
					const on = mix?.id === m.id
					return (
						<button
							key={m.id}
							type="button"
							aria-pressed={on}
							onClick={() => ctx.filters.set(wordsPatch(on ? [] : m.parts))}
							className={`group relative shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl text-left ring-2 transition ${
								on ? "ring-amber-400" : "ring-transparent hover:ring-white/30"
							} ${chosen ? "h-12 w-44" : "h-28 w-60 lg:h-32 lg:w-auto"}`}
							style={{ background: wordHue(m.parts[0]) }}
						>
							{pictures[m.id] && (
								<img
									src={backdrop(pictures[m.id], chosen ? "w300" : "w780")}
									alt=""
									className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
								/>
							)}
							<span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
							<span className={`absolute right-0 bottom-0 left-0 font-bold text-white ${chosen ? "p-2 text-[13px]" : "p-3 text-base"}`}>{m.name}</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
