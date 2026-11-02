// PROTOTYPE (discover-easy) A "Ask": the start page's search hero on Discover. One big field with example phrases,
// the eight mixes as picture tiles, and one quiet row for type and the essentials. Once something is chosen the hero
// shrinks to a compact bar with the choices as chips, and the results take the page.
import { START_PRESETS } from "~/ui/start/search/presets"
import {
	BigSearch,
	ChoiceChips,
	Count,
	type EasyContext,
	Essentials,
	FineTune,
	MIXES,
	ModeSwitch,
	Segmented,
	TYPE_CHOICES,
	activeMix,
	backdrop,
	hasChoice,
	usePictures,
	wordsPatch,
	wordHue,
} from "./kit"

export const name = "Ask"

export function VariantA({ ctx }: { ctx: EasyContext }) {
	const pictures = usePictures()
	const chosen = hasChoice(ctx)
	const mix = activeMix(ctx.filters.state)
	return (
		<section className="relative">
			<div className="flex items-center justify-between gap-3">
				<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[30px]">Discover</h1>
				<ModeSwitch />
			</div>

			<div className={`mx-auto transition-all ${chosen ? "mt-4 max-w-none" : "mt-10 max-w-3xl text-center lg:mt-16"}`}>
				{!chosen && (
					<p className="mb-5 text-2xl font-semibold text-white lg:text-4xl">
						What are you in the mood for?
					</p>
				)}
				<BigSearch ctx={ctx} size={chosen ? "lg" : "xl"} />
				{!chosen && (
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						{START_PRESETS.map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => ctx.onSearch(p)}
								className="cursor-pointer rounded-full bg-white/[0.06] px-3.5 py-1.5 text-sm text-gray-200 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
							>
								{p}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Mixes: big picture tiles before a choice, a slim strip after one. */}
			<div className={chosen ? "mt-4" : "mt-10 lg:mt-14"}>
				{!chosen && <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Or start with a feeling</p>}
				<div
					className={`-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 ${
						chosen ? "" : "lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
					}`}
				>
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
								} ${chosen ? "h-14 w-48" : "h-28 w-60 lg:h-36 lg:w-auto"}`}
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
								<span className={`absolute bottom-0 left-0 right-0 font-bold text-white ${chosen ? "p-2 text-sm" : "p-3 text-base lg:text-lg"}`}>
									{m.name}
								</span>
							</button>
						)
					})}
				</div>
			</div>

			<div className={`flex flex-wrap items-center gap-2 ${chosen ? "mt-3" : "mt-6 justify-center"}`}>
				<Segmented
					label="Type"
					value={ctx.filters.state.type}
					options={TYPE_CHOICES}
					onChange={(type) => ctx.filters.set({ type })}
				/>
				<Essentials ctx={ctx} />
			</div>

			{chosen && (
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
					<ChoiceChips ctx={ctx} />
					<div className="flex items-center gap-3 text-sm text-gray-400">
						<Count ctx={ctx} />
						<FineTune />
					</div>
				</div>
			)}
			{!chosen && <p className="mb-2 mt-12 text-lg font-semibold text-white">Popular right now</p>}
		</section>
	)
}
