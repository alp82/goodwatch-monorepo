// PROTOTYPE - throwaway. Scores baseline: the GoodWatch score as the big control on the left with Critics vs audiences
// under it, every source as one compact line with its logo on the right. Round 7: every source on one shared scale
// (6/60, 7/70, 8/80, 9/90), each in its own notation, so the columns line up.
import type { SectionProps } from "../../types"
import { ClearButton, GapChoices, GapLegend, GoodWatchMark, Head, SOURCES, ScoreHero, type Source, SourceLogo, SourceSteps, sourcesSet, sourceValue } from "./parts"
import type { ProtoDiscover } from "../../../kit"
import { setMcUsers, useMcUsers } from "./mc-users"

/** One scale for every source, on the 0-100 the filter stores: IMDb 7.0 is 70, like Tomatometer 70% and Metascore 70. */
const SCALE = [60, 70, 80, 90]

/** Metacritic's user score (0-10). Lab only: the key is a stand-in, the row runs on mc-users.ts. */
const MC_USERS: Source = { key: "metacritic", name: "User score", who: "Audience", site: "Metacritic", hex: "#facc15", steps: SCALE, fmt: (v) => (v / 10).toFixed(1) }

function ScaleRow({ d, s, dense, value, onPick }: { d: ProtoDiscover; s: Source; dense: boolean; value?: number; onPick?: (v: number) => void }) {
	return (
		<div className={`flex items-center gap-3 ${dense ? "h-10" : "h-11"}`}>
			<SourceLogo s={s} size={dense ? 26 : 28} />
			<span className="w-[118px] shrink-0 leading-tight">
				<span className="block text-[13px] font-semibold text-gray-100">{s.name}</span>
				<span className="block text-[11px] text-gray-500">
					{s.site === "IMDb" ? "Audience" : `${s.site === "Rotten Tomatoes" ? "RT" : s.site} ${s.who.toLowerCase()}`}
				</span>
			</span>
			<SourceSteps d={d} s={{ ...s, steps: SCALE }} value={value ?? sourceValue(d, s.key)} onPick={onPick} />
		</div>
	)
}

export function ScoresA({ d, phone }: SectionProps) {
	const minScore = d.filters.state.minScore
	const mc = useMcUsers()
	const sources = sourcesSet(d) + (mc ? 1 : 0)
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
						<ClearButton
							onClick={() => {
								setMcUsers(0)
								d.filters.set({ sourceScores: undefined })
							}}
						/>
					) : undefined
				}
			>
				Scores by source
			</Head>
			<div className="divide-y divide-white/[0.05]">
				{SOURCES.map((s) => (
					<ScaleRow key={s.key} d={d} s={s} dense={phone} />
				))}
				<ScaleRow d={d} s={MC_USERS} dense={phone} value={mc} onPick={setMcUsers} />
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
