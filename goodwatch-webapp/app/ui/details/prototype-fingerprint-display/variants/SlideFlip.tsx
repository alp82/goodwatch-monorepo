// PROTOTYPE - throwaway.
// Allsliders, polished: tapping a slider swaps its track for the traits behind it, in exactly the same space; nothing moves.
import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid"
import { useState } from "react"
import { HEX } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { GROUPS, GroupHead, KEYFRAMES, RowLabel, type Scale, SectionTitle, Track, reading, scaleTraits, strength } from "./slidepop-parts"

const fade = "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"

// Up to three traits as mini bars; the third only from sm up.
function MiniTraits({ sc, t }: { sc: Scale; t: F.TitleInput }) {
	const traits = scaleTraits(sc, t, 3)
	return (
		<span className="grid grid-cols-2 items-center gap-x-4 sm:grid-cols-3">
			{traits.map((d, i) => {
				const meta = getFingerprintMeta(d.key)
				return (
					<span key={d.key} className={`min-w-0 ${i === 2 ? "hidden sm:block" : ""}`}>
						<span className="block truncate text-xs text-gray-100">{meta.label}</span>
						<span className="mt-1 block h-1 rounded-full bg-white/[0.07]">
							<span className="block h-1 rounded-full" style={{ width: `${d.score * 10}%`, background: HEX[sc.area] }} />
						</span>
						<span className="mt-0.5 hidden text-[11px] leading-tight text-gray-500 sm:block">{strength(d.score)}</span>
					</span>
				)
			})}
		</span>
	)
}

function Row({ sc, t, open, onToggle }: { sc: Scale; t: F.TitleInput; open: boolean; onToggle: () => void }) {
	const r = reading(sc, t)
	const traits = scaleTraits(sc, t, 3)
	const traitText = traits.map((d) => `${getFingerprintMeta(d.key).label} ${strength(d.score).toLowerCase()}`).join(", ")
	return (
		<li>
			<button
				type="button"
				aria-pressed={open}
				aria-label={`${sc.name}: ${r.word}. ${open ? `Traits: ${traitText}.` : `Between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}. Show traits.`}`}
				onClick={onToggle}
				className={`group -mx-2.5 grid w-[calc(100%+1.25rem)] cursor-pointer grid-cols-[7.25rem_1fr] items-center gap-x-3 rounded-xl px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 sm:grid-cols-[7.75rem_1fr] sm:py-2 ${open ? "bg-white/[0.05]" : ""}`}
			>
				<RowLabel sc={sc} word={r.word} />
				{/* Both faces share one grid cell, so the row is always as tall as the taller face. */}
				<span className="grid items-center" aria-hidden="true">
					<span
						className={`col-start-1 row-start-1 grid grid-cols-2 items-center gap-x-3 gap-y-1 sm:grid-cols-[5.5rem_1fr_7.5rem] ${fade} ${open ? "-translate-y-1 opacity-0" : ""}`}
					>
						<span className={`order-2 text-xs sm:order-1 sm:text-right ${r.near === "left" ? "text-gray-100" : "text-gray-500"}`}>{sc.left}</span>
						<Track v={r.v} area={sc.area} label="" className="order-1 col-span-2 sm:order-2 sm:col-span-1" />
						<span className={`order-3 text-right text-xs sm:text-left ${r.near === "right" ? "text-gray-100" : "text-gray-500"}`}>{sc.right}</span>
					</span>
					<span className={`col-start-1 row-start-1 flex items-center gap-3 ${fade} ${open ? "" : "pointer-events-none translate-y-1 opacity-0"}`}>
						<span className="min-w-0 flex-1">
							<MiniTraits sc={sc} t={t} />
						</span>
						<ArrowUturnLeftIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 group-hover:text-gray-300" />
					</span>
				</span>
			</button>
		</li>
	)
}

export default function SlideFlip({ t }: VariantProps) {
	const [open, setOpen] = useState<string | null>(null)
	return (
		<div onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
			<style>{KEYFRAMES}</style>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-gray-300">{F.summary(t)}</p>

			<div className="mt-6 grid gap-x-16 gap-y-6 lg:grid-cols-2 [&>*]:min-w-0">
				{[[GROUPS[0]], [GROUPS[1], GROUPS[2]]].map((col) => (
					<div key={col[0].name} className="space-y-6">
						{col.map((g) => (
							<section key={g.name}>
								<GroupHead name={g.name} />
								<ul>
									{g.scales.map((sc) => (
										<Row key={sc.name} sc={sc} t={t} open={open === sc.name} onToggle={() => setOpen(open === sc.name ? null : sc.name)} />
									))}
								</ul>
							</section>
						))}
					</div>
				))}
			</div>
			<p className="mt-4 text-xs text-gray-500">
				<span className="hidden sm:inline">Select a scale to swap it for the traits behind it.</span>
				<span className="sm:hidden">Tap a scale to swap it for the traits behind it.</span>
			</p>
		</div>
	)
}
