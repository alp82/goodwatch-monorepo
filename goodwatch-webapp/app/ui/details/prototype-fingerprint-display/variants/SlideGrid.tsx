// PROTOTYPE - throwaway.
// Grid's 3x2 word grid on the left, a stack of two-ended sliders on the right, intensity and good-for lines under both.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { Fragment, useRef, useState } from "react"
import { AttributeGrid, HEX, Meter, PILLARS, type Pillar, PillarName, tint } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SCALES, Track, intensity, reading } from "./slidestrip-parts"
import { SectionTitle, areaWord, cap, goodFor } from "./strip-parts"

export default function SlideGrid({ t }: VariantProps) {
	const tiers = t.fingerprint.pillars
	const [open, setOpen] = useState<Pillar | null>(null)
	const cells = useRef<Record<string, HTMLButtonElement | null>>({})
	const intense = intensity(t)
	const good = goodFor(t, 5).shown
	const close = () => {
		const p = open
		setOpen(null)
		if (p) cells.current[p]?.focus()
	}

	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-lg leading-snug text-gray-200">{F.summary(t)}</p>

			<div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr] lg:gap-10 [&>*]:min-w-0">
				<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" onKeyDown={(e) => e.key === "Escape" && close()}>
					{PILLARS.map((p) => {
						const lead = F.pillarDrivers(t, p)
							.filter((d) => d.score >= 6)
							.slice(0, 2)
							.map((d) => getFingerprintMeta(d.key).label.toLowerCase())
						const on = open === p
						return (
							<li key={p}>
								<button
									type="button"
									ref={(el) => {
										cells.current[p] = el
									}}
									onClick={() => setOpen(on ? null : p)}
									aria-expanded={on}
									aria-controls="slidegrid-traits"
									aria-label={`${p}: ${areaWord(p, tiers[p])}. Show every ${p.toLowerCase()} trait`}
									className={`h-full w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "border-white/30" : "border-white/8"}`}
									style={tint(p, on ? 18 : 8)}
								>
									<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
										<PillarName p={p} className="text-sm text-gray-300" />
										<Meter tier={tiers[p]} p={p} />
									</span>
									<span className="mt-1 block font-semibold leading-snug text-white">{cap(areaWord(p, tiers[p]))}</span>
									{lead.length > 0 && <span className="mt-0.5 block truncate text-xs text-gray-400">{F.list(lead)}</span>}
								</button>
							</li>
						)
					})}
				</ul>

				<ul className="flex flex-col justify-between gap-4">
					{SCALES.map((sc) => {
						const r = reading(sc, t)
						return (
							<li key={sc.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-x-4">
								<div>
									<p className="text-xs text-gray-400">{sc.name}</p>
									<p className="text-sm font-semibold leading-tight text-white">{r.word}</p>
								</div>
								<div>
									<Track
										v={r.v}
										area={sc.area}
										label={`${sc.name}: ${r.word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
									/>
									<p className="mt-1.5 flex justify-between gap-2 text-xs">
										<span className={r.near === "left" ? "text-gray-300" : "text-gray-500"}>{sc.left}</span>
										<span className={r.near === "right" ? "text-gray-300" : "text-gray-500"}>{sc.right}</span>
									</p>
								</div>
							</li>
						)
					})}
				</ul>
			</div>

			{open && (
				<section
					id="slidegrid-traits"
					aria-label={`Every ${open.toLowerCase()} trait`}
					className="relative mt-3 rounded-2xl border border-white/10 p-5 motion-safe:animate-[sgFade_150ms_ease-out] sm:p-6"
					style={tint(open)}
					onKeyDown={(e) => e.key === "Escape" && close()}
				>
					<style>{"@keyframes sgFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"}</style>
					<p className="mb-4 text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[open] }}>
						{PILLAR_CONFIG[open].emoji} {open}
					</p>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						<XMarkIcon className="h-5 w-5" aria-hidden="true" />
					</button>
					<AttributeGrid t={t} p={open} meaning={false} />
				</section>
			)}

			<div className="mt-5 flex flex-col gap-1.5 border-t border-white/8 pt-4 text-sm lg:flex-row lg:items-baseline lg:gap-10">
				<p className="leading-relaxed">
					<span className="font-semibold text-gray-300">Intensity</span>{" "}
					{intense.length === 0 && <span className="text-gray-200">nothing to flag</span>}
					{intense.map((x, i) => (
						<Fragment key={x.key}>
							{i > 0 && <span className="text-gray-600"> · </span>}
							<span className="whitespace-nowrap">
								<span className="text-gray-400">{x.label.toLowerCase()}</span> <span className="text-white">{x.word}</span>
							</span>
						</Fragment>
					))}
				</p>
				<p className="leading-relaxed text-gray-300">
					<span className="font-semibold text-emerald-200">Good for</span> {good.join(" · ").toLowerCase()}
				</p>
			</div>
		</div>
	)
}
