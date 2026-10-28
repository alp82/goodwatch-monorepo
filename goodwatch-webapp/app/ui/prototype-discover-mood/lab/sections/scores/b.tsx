// PROTOTYPE - throwaway. Scores, stacked: the GoodWatch score across the full width, then the sources as one row of
// logo chips that show their threshold. Tapping a chip opens its steps in the fixed line under the row.
import { motion } from "framer-motion"
import { useState } from "react"
import type { SourceKey } from "~/domain/filter-state"
import { TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import { ClearButton, GapChoices, GapLegend, GoodWatchMark, Head, SOURCES, ScoreHero, SourceLogo, SourceSteps, sourceValue, sourcesSet } from "./parts"

export function ScoresB({ d, phone }: SectionProps) {
	const minScore = d.filters.state.minScore
	const sources = sourcesSet(d)
	const [openKey, setOpenKey] = useState<SourceKey>("imdb")
	const open = SOURCES.find((s) => s.key === openKey) ?? SOURCES[0]
	return (
		<div className={phone ? "space-y-6" : "flex h-full flex-col gap-5 px-7 py-5"}>
			<section>
				<Head
					icon={<GoodWatchMark v={minScore || undefined} />}
					note="Every source in one"
					right={minScore ? <ClearButton onClick={() => d.filters.set({ minScore: 0 })} /> : undefined}
				>
					GoodWatch score
				</Head>
				<ScoreHero d={d} compact />
			</section>
			<div className={phone ? "space-y-6" : "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10"}>
				<section className="min-w-0">
					<Head
						note={sources ? `${sources} set · each must pass` : undefined}
						right={sources ? <ClearButton onClick={() => d.filters.set({ sourceScores: undefined })} /> : undefined}
					>
						By source
					</Head>
					<div className={`flex gap-1.5 ${phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : ""}`}>
						{SOURCES.map((s) => {
							const v = sourceValue(d, s.key)
							const sel = s.key === openKey
							return (
								<motion.button
									key={s.key}
									type="button"
									whileTap={TAP}
									aria-expanded={sel}
									onClick={() => setOpenKey(s.key)}
									className={`flex h-10 shrink-0 items-center gap-2 rounded-xl pr-2.5 pl-1.5 text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
										sel ? "bg-white/[0.12] ring-1 ring-inset ring-white/25" : "bg-white/[0.05] hover:bg-white/[0.09]"
									}`}
								>
									<SourceLogo s={s} size={28} />
									<span className="text-gray-100">{s.name}</span>
									<span
										className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${v ? "" : "text-gray-500"}`}
										style={v ? { background: s.hex, color: s.key === "imdb" ? "#000" : "#fff" } : undefined}
									>
										{v ? `${s.fmt(v)}+` : "Any"}
									</span>
								</motion.button>
							)
						})}
					</div>
					<div className="mt-2.5 flex h-11 items-center gap-3 rounded-xl bg-white/[0.03] px-3">
						<span className="w-[150px] shrink-0 truncate text-[12px] text-gray-400">
							{open.site === "IMDb" ? "IMDb rating" : `${open.name}, ${open.who.toLowerCase()}`}
						</span>
						<SourceSteps key={open.key} d={d} s={open} value={sourceValue(d, open.key)} />
					</div>
				</section>
				<section className="min-w-0">
					<Head right={d.filters.state.scoreGap ? <ClearButton onClick={() => d.filters.set({ scoreGap: undefined })} /> : <GapLegend />}>
						Critics vs audiences
					</Head>
					<GapChoices d={d} layout={phone ? "col" : "grid"} />
				</section>
			</div>
		</div>
	)
}
