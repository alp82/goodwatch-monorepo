// PROTOTYPE - throwaway.
// Strip's tagline, sentence and six area cards (tap for the inline panel), then the two-ended sliders as a compact band.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useRef, useState } from "react"
import { DriverBars, HEX, Meter, MoreLinks, type Pillar, PILLARS, Verdict, tint } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SCALES, Track, reading } from "./slidestrip-parts"
import { SectionTitle, TraitChip, shortWord, tagline, topTraits } from "./strip-parts"

export default function SlideStrip({ t, media }: VariantProps) {
	const [open, setOpen] = useState<Pillar | null>(null)
	const cells = useRef<Record<string, HTMLButtonElement | null>>({})
	const tiers = t.fingerprint.pillars
	const traits = topTraits(t, media, 8)
	const close = () => {
		const p = open
		setOpen(null)
		if (p) cells.current[p]?.focus()
	}
	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-2 text-2xl font-semibold tracking-tight text-amber-200">{tagline(t, media)}.</p>
			<p className="mt-1 text-gray-300">{F.summary(t)}</p>

			<div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6" onKeyDown={(e) => e.key === "Escape" && close()}>
				{PILLARS.map((p) => {
					const on = open === p
					return (
						<button
							key={p}
							ref={(el) => {
								cells.current[p] = el
							}}
							type="button"
							aria-expanded={on}
							aria-controls="slidestrip-panel"
							onClick={() => setOpen(on ? null : p)}
							className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
								on ? "border-white/30" : "border-white/8 hover:border-white/20 hover:bg-white/3"
							}`}
							style={on ? tint(p, 16) : undefined}
						>
							<span className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
								<span className="flex items-center gap-1.5 text-sm text-gray-300">
									<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
									{p}
								</span>
								<Meter tier={tiers[p]} p={p} />
							</span>
							<span className="text-sm font-semibold text-white">{shortWord(p, tiers[p])}</span>
						</button>
					)
				})}
			</div>

			{open && (
				<section
					id="slidestrip-panel"
					aria-label={`${open} in detail`}
					onKeyDown={(e) => e.key === "Escape" && close()}
					className="relative mt-2 rounded-2xl border border-white/10 p-4 animate-[ssFade_160ms_ease-out] sm:p-5"
					style={tint(open, 12)}
				>
					<style>{"@keyframes ssFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						<XMarkIcon className="h-5 w-5" aria-hidden="true" />
					</button>
					<div className="grid gap-5 md:grid-cols-[1fr_17rem] md:gap-10 md:pr-10 [&>*]:min-w-0">
						<div className="space-y-4 pr-8">
							<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[open] }}>
								{PILLAR_CONFIG[open].emoji} {open}
							</p>
							<Verdict t={t} p={open} size="lg" />
							<div className="hidden md:block">
								<MoreLinks t={t} p={open} />
							</div>
						</div>
						<DriverBars t={t} p={open} compact />
						<div className="md:hidden">
							<MoreLinks t={t} p={open} />
						</div>
					</div>
				</section>
			)}

			<ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 lg:grid-cols-4 lg:gap-x-8">
				{SCALES.map((sc) => {
					const r = reading(sc, t)
					return (
						<li key={sc.name} className="min-w-0">
							<p className="flex flex-col text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
								<span className="text-xs text-gray-400 sm:text-sm">{sc.name}</span>
								<span className="font-semibold text-white">{r.word}</span>
							</p>
							<Track
								v={r.v}
								area={sc.area}
								className="mt-2"
								label={`${sc.name}: ${r.word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
							/>
							<p className="mt-1.5 flex justify-between gap-2 text-xs">
								<span className={r.near === "left" ? "text-gray-300" : "text-gray-500"}>{sc.left}</span>
								<span className={`text-right ${r.near === "right" ? "text-gray-300" : "text-gray-500"}`}>{sc.right}</span>
							</p>
						</li>
					)
				})}
			</ul>

			<div className="mt-4 flex h-8 flex-wrap items-center gap-1.5 overflow-hidden">
				<span className="mr-1 text-sm font-semibold text-gray-300">Stands out</span>
				{traits.map((x) => (
					<TraitChip key={x.key} trait={x} />
				))}
			</div>
		</div>
	)
}
