// PROTOTYPE - throwaway. A six-spoke identity glyph with the values spelled out beside it, then ranked trait chips.
import { useState } from "react"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import { DriverBars, HEX, MoreLinks, PILLARS, type Pillar } from "../../DetailsFingerprint"
import type { VariantProps } from "../types"
import { FpHeading } from "./sheet-head"
import { AREA_WORD, goodFor, rankedTraits, tagline } from "./sheet-words"

const C = 60
const R0 = 13
const STEP = 10.5

function spoke(i: number, len: number) {
	const a = ((i * 60 - 90) * Math.PI) / 180
	return { x1: C + Math.cos(a) * R0, y1: C + Math.sin(a) * R0, x2: C + Math.cos(a) * (R0 + len), y2: C + Math.sin(a) * (R0 + len) }
}

function Mark({ tiers, active, onPick, className }: { tiers: Record<Pillar, number>; active: Pillar | null; onPick: (p: Pillar) => void; className?: string }) {
	return (
		<svg viewBox="0 0 120 120" className={className} aria-hidden="true">
			{[1, 2, 3, 4].map((r) => (
				<circle key={r} cx={C} cy={C} r={R0 + r * STEP} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={r === 4 ? 1 : 0.6} />
			))}
			{PILLARS.map((p, i) => {
				const tier = tiers[p]
				const track = spoke(i, 4 * STEP)
				const bar = spoke(i, Math.max(1.5, tier * STEP))
				const dim = active && active !== p
				return (
					// biome-ignore lint/a11y/useKeyWithClickEvents: the word buttons beside the glyph are the keyboard path
					<g key={p} onClick={() => onPick(p)} className="cursor-pointer" style={{ opacity: dim ? 0.3 : 1, transition: "opacity 150ms" }}>
						<line {...track} stroke="transparent" strokeWidth={16} />
						<line {...track} stroke="rgba(255,255,255,.07)" strokeWidth={8} strokeLinecap="round" />
						<line {...bar} stroke={HEX[p]} strokeWidth={8} strokeLinecap="round" />
					</g>
				)
			})}
			<circle cx={C} cy={C} r={5} fill="rgba(253,230,138,.85)" />
		</svg>
	)
}

export default function Glyph(props: VariantProps) {
	const { t } = props
	const tiers = t.fingerprint.pillars
	const [active, setActive] = useState<Pillar | null>(null)
	const traits = rankedTraits(props, 8)
	const good = goodFor(t, 3).shown
	const pick = (p: Pillar) => setActive(active === p ? null : p)

	return (
		<div>
			<FpHeading t={t} />
			<div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-amber-300/[.06] via-transparent to-transparent p-5 sm:p-7">
				<div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:gap-10">
					<div className="flex items-center gap-5 sm:gap-7">
						<Mark tiers={tiers} active={active} onPick={pick} className="h-28 w-28 shrink-0 sm:h-36 sm:w-36" />
						<ul className="grid gap-0.5 text-sm" aria-label="Areas">
							{PILLARS.map((p) => (
								<li key={p}>
									<button
										type="button"
										aria-expanded={active === p}
										aria-controls="fp-glyph-detail"
										onClick={() => pick(p)}
										className={`grid w-full cursor-pointer grid-cols-[4.25rem_auto] items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-amber-300 ${
											active && active !== p ? "opacity-50" : ""
										} ${active === p ? "bg-white/8" : "hover:bg-white/5"}`}
									>
										<span className="flex items-center gap-1.5 text-gray-400">
											<span className="h-2 w-2 rounded-full" style={{ background: HEX[p] }} />
											{p}
										</span>
										<span className="font-semibold text-white">{AREA_WORD[p][tiers[p]]}</span>
									</button>
								</li>
							))}
						</ul>
					</div>
					<div className="min-w-0 self-center">
						<p className="text-3xl font-semibold leading-tight tracking-tight text-amber-200 [text-wrap:balance]">{tagline(t) || F.pillarLine(t)}.</p>
						<p className="mt-2 leading-relaxed text-gray-300">{F.summary(t)}</p>
						<ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Strongest traits, most distinctive first">
							{traits.map((x, i) => (
								<li
									key={x.key}
									className={`rounded-full px-2.5 py-1 text-sm ${i < 3 ? "bg-white/12 font-medium text-white" : "bg-white/5 text-gray-300"}`}
								>
									{x.label}
								</li>
							))}
						</ol>
						{good.length > 0 && (
							<p className="mt-3 text-sm text-gray-400">
								Good for <span className="text-emerald-200">{F.list(good.map((g) => g.toLowerCase()))}</span>
							</p>
						)}
					</div>
				</div>
				<div id="fp-glyph-detail" aria-live="polite">
					{active && (
						<div className="mt-6 grid gap-5 border-t border-white/10 pt-5 md:grid-cols-[1fr_18rem] md:gap-10">
							<div>
								<p className="flex items-center gap-2 text-sm" style={{ color: HEX[active] }}>
									<span aria-hidden="true">{PILLAR_CONFIG[active].emoji}</span>
									{active} · {AREA_WORD[active][tiers[active]].toLowerCase()}
								</p>
								<p className="mt-1 text-lg font-semibold text-white">{F.pillarBrief(t, active).verdict}</p>
								{!F.pillarSentence(t, active).toLowerCase().includes(F.pillarBrief(t, active).verdict.toLowerCase()) && (
									<p className="mt-1 text-sm leading-relaxed text-gray-300">{F.pillarSentence(t, active)}</p>
								)}
								<div className="mt-4 [&_a]:px-3 [&_a]:py-1 [&_a]:text-xs">
									<MoreLinks t={t} p={active} />
								</div>
							</div>
							<DriverBars t={t} p={active} />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
