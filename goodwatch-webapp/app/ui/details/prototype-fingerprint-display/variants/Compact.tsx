// PROTOTYPE - throwaway.
// The tightest version: heading and tagline on one line, one-line sliders, then the six areas as a line of words with tiny meters.
import { Fragment, useState } from "react"
import { HEX, PILLARS, type Pillar, TIER_WORD } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SCALES, Track, reading } from "./slidestrip-parts"
import { SectionTitle, areaWord, cap, tagline } from "./strip-parts"

// Meter's colors and steps at a third of the size.
function TinyMeter({ tier, p }: { tier: number; p: Pillar }) {
	return (
		<span className="inline-flex gap-px" aria-hidden="true">
			{[0, 1, 2, 3].map((i) => (
				<span
					key={i}
					className="h-1.5 w-1.5 rounded-[1px]"
					style={{ background: i < tier ? HEX[p] : "rgba(255,255,255,.12)", opacity: i < tier ? 0.55 + i * 0.15 : 1 }}
				/>
			))}
		</span>
	)
}

export default function Compact({ t, media }: VariantProps) {
	const tiers = t.fingerprint.pillars
	const [open, setOpen] = useState<Pillar | null>(null)
	const brief = open ? F.pillarBrief(t, open) : null
	return (
		<div onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<SectionTitle t={t} />
				<p className="text-lg font-semibold tracking-tight text-amber-200">{tagline(t, media)}.</p>
			</div>

			<ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
				{SCALES.map((sc) => {
					const r = reading(sc, t)
					return (
						<li
							key={sc.name}
							className="flex items-center gap-2.5"
							title={`${sc.left} to ${sc.right.toLowerCase()}`}
						>
							<span className="w-[4.5rem] shrink-0 text-xs text-gray-400">{sc.name}</span>
							<Track
								v={r.v}
								area={sc.area}
								size="dot"
								className="min-w-10 flex-1"
								label={`${sc.name}: ${r.word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
							/>
							<span className="w-[7.5rem] shrink-0 text-sm font-semibold text-white lg:w-auto lg:max-w-[8.5rem]">{r.word}</span>
						</li>
					)
				})}
			</ul>

			<p className="-ml-2 mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
				{PILLARS.map((p, i) => {
					const on = open === p
					return (
						<Fragment key={p}>
							{i > 0 && (
								<span className="hidden text-gray-600 sm:inline" aria-hidden="true">
									·
								</span>
							)}
							<button
								type="button"
								aria-expanded={on}
								aria-controls="compact-area"
								aria-label={`${p}: ${areaWord(p, tiers[p])}, ${TIER_WORD[tiers[p]].toLowerCase()}. ${on ? "Hide" : "Show"} why`}
								onClick={() => setOpen(on ? null : p)}
								className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/10" : ""}`}
							>
								<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
								<span className="text-gray-100">{cap(areaWord(p, tiers[p]))}</span>
								<TinyMeter tier={tiers[p]} p={p} />
							</button>
						</Fragment>
					)
				})}
			</p>

			{open && brief && (
				<p
					id="compact-area"
					className="mt-2 border-l-2 pl-3 text-sm leading-relaxed text-gray-300 motion-safe:animate-[cpFade_150ms_ease-out]"
					style={{ borderColor: HEX[open] }}
				>
					<style>{"@keyframes cpFade{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}"}</style>
					<span className="font-semibold text-white">{brief.verdict}</span>{" "}
					<span className="text-gray-400">
						Driven by {F.list(brief.drivers.map((d) => getFingerprintMeta(d.key).label.toLowerCase()))}.
					</span>
				</p>
			)}
		</div>
	)
}
