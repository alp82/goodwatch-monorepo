// PROTOTYPE - throwaway. Scores baseline: the GoodWatch score as the big control on the left with Critics vs audiences
// under it, every source as one compact line with its logo on the right.
import type { SectionProps } from "../../types"
import { ClearButton, GapChoices, GapLegend, GoodWatchMark, Head, SOURCES, ScoreHero, SourceRow, sourcesSet } from "./parts"

export function ScoresA({ d, phone }: SectionProps) {
	const minScore = d.filters.state.minScore
	const sources = sourcesSet(d)
	const score = (
		<section>
			<Head
				icon={<GoodWatchMark v={minScore || undefined} />}
				note="Every source in one"
				right={minScore ? <ClearButton onClick={() => d.filters.set({ minScore: 0 })} /> : undefined}
			>
				GoodWatch score
			</Head>
			<ScoreHero d={d} compact={phone} />
		</section>
	)
	const gap = (
		<section>
			<Head right={d.filters.state.scoreGap ? <ClearButton onClick={() => d.filters.set({ scoreGap: undefined })} /> : <GapLegend />}>
				Critics vs audiences
			</Head>
			<GapChoices d={d} layout={phone ? "col" : "row"} />
		</section>
	)
	const bySource = (
		<section>
			<Head
				note={sources ? `${sources} set · each must pass` : "Each must pass"}
				right={
					sources ? (
<ClearButton onClick={() => d.filters.set({ sourceScores: undefined })} />
					) : undefined
				}
			>
				Scores by source
			</Head>
			<div className="divide-y divide-white/[0.05]">
				{SOURCES.map((s) => (
					<SourceRow key={s.key} d={d} s={s} dense={phone} />
				))}
			</div>
		</section>
	)
	if (phone)
		return (
			<div className="space-y-6">
				{score}
				{bySource}
				{gap}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 px-7 py-5">
			<div className="flex min-w-0 flex-col gap-6">
				{score}
				{gap}
			</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-10">{bySource}</div>
		</div>
	)
}
