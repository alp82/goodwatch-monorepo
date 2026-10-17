// PROTOTYPE - throwaway.
// Tagline and sentence, a strip of six area cells that open one inline panel, top trait chips and a good-for line.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useRef, useState } from "react"
import { DriverBars, HEX, Meter, MoreLinks, type Pillar, PILLARS, Verdict, tint } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, TraitChip, firstSkip, goodFor, shortWord, tagline, topTraits } from "./strip-parts"

export default function Strip({ t, media }: VariantProps) {
	const [open, setOpen] = useState<Pillar | null>(null)
	const [allGood, setAllGood] = useState(false)
	const cells = useRef<Record<string, HTMLButtonElement | null>>({})
	const tiers = t.fingerprint.pillars
	const traits = topTraits(t, media, 8)
	const good = goodFor(t, 4)
	const skip = firstSkip(t)
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

			<div className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-6" onKeyDown={(e) => e.key === "Escape" && close()}>
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
							aria-controls="strip-panel"
							onClick={() => setOpen(on ? null : p)}
							className={`flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
								on ? "border-white/30" : "border-white/8 hover:border-white/20 hover:bg-white/3"
							}`}
							style={on ? tint(p, 16) : undefined}
						>
							<span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
								<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
								{p}
							</span>
							<Meter tier={tiers[p]} p={p} />
							<span className="text-sm text-white">{shortWord(p, tiers[p])}</span>
						</button>
					)
				})}
			</div>

			{open && (
				<section
					id="strip-panel"
					aria-label={`${open} in detail`}
					onKeyDown={(e) => e.key === "Escape" && close()}
					className="relative mt-2 rounded-2xl border border-white/10 p-4 sm:p-5 animate-[fadeUp_160ms_ease-out]"
					style={tint(open, 12)}
				>
					<style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-300 hover:bg-white/10 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
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

			<div className="mt-5 flex flex-wrap items-center gap-1.5">
				<span className="mr-1 text-sm font-semibold text-gray-300">Stands out</span>
				{traits.map((x, i) => (
					<TraitChip key={x.key} trait={x} className={i >= 6 ? "max-sm:hidden" : ""} />
				))}
			</div>

			<p className="mt-4 text-sm leading-relaxed text-gray-300">
				<span className="font-semibold text-emerald-200">Good for</span>{" "}
				{(allGood ? [...good.shown, ...good.rest] : good.shown).join(" · ").toLowerCase()}
				{good.rest.length > 0 && !allGood && (
					<button type="button" onClick={() => setAllGood(true)} className="ml-1 text-gray-400 underline decoration-white/30 underline-offset-2 hover:text-white cursor-pointer">
						+{good.rest.length} more
					</button>
				)}
				{skip && (
					<>
						<span className="mx-2 text-gray-600">|</span>
						<span className="font-semibold text-rose-200">Skip it if</span> {skip}
					</>
				)}
			</p>
		</div>
	)
}
