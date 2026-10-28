// PROTOTYPE - throwaway. Scores as two sides: critics' sources on the left, audiences' on the right, the GoodWatch
// score as a ladder in the middle. Critics vs audiences runs under them as one scale from the critics' side to the
// audiences' side.
import { motion } from "framer-motion"
import type { ScoreGap } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { scoreWord } from "~/utils/ratings"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import {
	ClearButton,
	GAP_WORDS,
	GapGlyph,
	GoodWatchMark,
	Head,
	SCORE_STEPS,
	SOURCES,
	SourceRow,
	gapCount,
	scoreCount,
	setGap,
	setScore,
	vibeHex,
} from "./parts"

const CRITICS = SOURCES.filter((s) => s.who === "Critics")
const AUDIENCE = SOURCES.filter((s) => s.who === "Audience")

function SideMark({ color }: { color: string }) {
	return <span className="h-3.5 w-1.5 rounded-full" style={{ background: color }} />
}

function Ladder({ d }: { d: ProtoDiscover }) {
	const value = d.filters.state.minScore
	return (
		<div role="radiogroup" aria-label="GoodWatch score" className="grid gap-1.5">
			{[...SCORE_STEPS].reverse().map((v) => {
				const on = v === value
				const lit = value !== 0 && v >= value
				const n = scoreCount(d, v)
				return (
					<motion.button
						key={v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => setScore(d, v)}
						className={`flex h-12 items-center gap-3 rounded-xl px-3.5 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on ? "ring-2 ring-inset ring-white" : ""
						} ${lit || on ? "" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}
						style={lit ? { background: `color-mix(in srgb, ${vibeHex(v)} ${on ? 55 : 28}%, #111418)` } : undefined}
					>
						<span className={`w-14 text-[20px] font-bold tabular-nums ${lit || on ? "text-white" : "text-gray-300"}`}>{v ? `${v}+` : "Any"}</span>
						<span className={`flex-1 text-[13px] ${lit || on ? "text-white/85" : "text-gray-500"}`}>{v ? scoreWord(v) : "Every score"}</span>
						{!on && n != null && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>}
					</motion.button>
				)
			})}
		</div>
	)
}

/** From the critics' end to the audiences' end, Any off to the side. */
function Balance({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	const value = d.filters.state.scoreGap
	const order: ScoreGap[] = ["critics", "agree", "audience"]
	return (
		<div className={`flex items-center gap-3 ${phone ? "flex-col items-stretch" : ""}`}>
			<span className="shrink-0 text-[14px] font-semibold text-gray-100">Critics vs audiences</span>
			<div role="radiogroup" aria-label="Critics vs audiences" className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
				{order.map((g) => {
					const on = value === g
					const n = gapCount(d, g)
					return (
						<motion.button
							key={g}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: a single choice; the buttons carry the radio role
							role="radio"
							aria-checked={on}
							whileTap={TAP}
							onClick={() => setGap(d, g)}
							className={`flex h-10 items-center gap-2 rounded-lg px-2.5 text-[13px] cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
								g === "critics" ? "justify-start" : g === "audience" ? "flex-row-reverse justify-start text-right" : "justify-center"
							} ${on ? "bg-white font-semibold text-gray-950" : "text-gray-300 hover:bg-white/[0.07]"}`}
						>
							<span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${on ? "bg-gray-950" : "bg-black/30"}`}>
								<GapGlyph gap={g} size={18} />
							</span>
							<span className="min-w-0 truncate">{phone ? GAP_WORDS[g].short : GAP_WORDS[g].label}</span>
							{!on && n != null && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>}
						</motion.button>
					)
				})}
			</div>
			{value ? (
				<ClearButton onClick={() => d.filters.set({ scoreGap: undefined })} />
			) : (
				!phone && <span className="w-[42px] shrink-0 text-center text-[12px] text-gray-500">Any</span>
			)}
		</div>
	)
}

export function ScoresC({ d, phone }: SectionProps) {
	const minScore = d.filters.state.minScore
	const sources = d.filters.state.sourceScores ?? {}
	const side = (title: string, color: string, list: typeof SOURCES) => {
		const set = list.filter((s) => sources[s.key]).length
		return (
			<section className="min-w-0">
				<Head
					icon={<SideMark color={color} />}
					note={set ? `${set} set` : undefined}
					right={
						set ? (
							<ClearButton
								onClick={() => {
									const next = { ...sources }
									for (const s of list) delete next[s.key]
									d.filters.set({ sourceScores: Object.keys(next).length ? next : undefined })
								}}
							/>
						) : undefined
					}
				>
					{title}
				</Head>
				<div className="divide-y divide-white/[0.05]">
					{list.map((s) => (
						<SourceRow key={s.key} d={d} s={s} dense={phone} />
					))}
				</div>
			</section>
		)
	}
	const center = (
		<section className="min-w-0">
			<Head
				icon={<GoodWatchMark v={minScore || undefined} />}
				right={minScore ? <ClearButton onClick={() => d.filters.set({ minScore: 0 })} /> : undefined}
			>
				GoodWatch score
			</Head>
			<Ladder d={d} />
		</section>
	)
	if (phone)
		return (
			<div className="space-y-6">
				{center}
				{side("Critics", "#f83309", CRITICS)}
				{side("Audiences", "#f6c800", AUDIENCE)}
				<Balance d={d} phone />
			</div>
		)
	return (
		<div className="flex h-full flex-col gap-5 px-7 py-5">
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-8">
				{side("Critics", "#f83309", CRITICS)}
				{center}
				{side("Audiences", "#f6c800", AUDIENCE)}
			</div>
			<div className="border-t border-white/[0.06] pt-4">
				<Balance d={d} phone={false} />
			</div>
		</div>
	)
}
