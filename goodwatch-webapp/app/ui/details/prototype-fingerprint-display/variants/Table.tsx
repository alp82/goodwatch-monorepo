// PROTOTYPE - throwaway. Two columns: words and the standout on the left, a dense six-row table of areas on the right.
import { useState } from "react"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import { DriverBars, HEX, Meter, MoreLinks, PILLARS, type Pillar } from "../../DetailsFingerprint"
import type { VariantProps } from "../types"
import { Chip, FpHeading } from "./sheet-head"
import { AREA_PHRASE, AREA_WORD, cap, goodFor, standout, tagline, traitLabel } from "./sheet-words"

export default function Table(props: VariantProps) {
	const { t } = props
	const tiers = t.fingerprint.pillars
	const top = standout(t)
	const good = goodFor(t, 5)
	const skip = F.skipIf(t).slice(0, 2)
	// Hover previews a row; a click or tap pins it until another row is chosen or it's closed.
	const [hover, setHover] = useState<Pillar | null>(null)
	const [pinned, setPinned] = useState<Pillar | null>(null)
	const active = pinned ?? hover

	return (
		<div>
			<FpHeading t={t} />
			<div className="mt-5 grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
				<div className="min-w-0">
					<p className="text-2xl font-semibold tracking-tight text-amber-200">{tagline(t) || F.pillarLine(t)}.</p>
					<p className="mt-1.5 leading-relaxed text-gray-300">{F.summary(t)}</p>
					<p
						className="mt-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-4 text-sm"
						style={{ background: `color-mix(in srgb, ${HEX[top]} 18%, transparent)` }}
					>
						<span aria-hidden="true">{PILLAR_CONFIG[top].emoji}</span>
						<span className="text-gray-300">Standout:</span>
						<span className="font-semibold text-white">{AREA_PHRASE[top][tiers[top]]}</span>
					</p>
					<dl className="mt-5 space-y-3 text-sm">
						<div className="flex flex-wrap items-center gap-1.5">
							<dt className="mr-1 shrink-0 text-gray-400 sm:w-20 sm:mr-0">Good for</dt>
							{good.shown.map((g) => (
								<dd key={g}>
									<Chip>{g}</Chip>
								</dd>
							))}
						</div>
						{skip.length > 0 && (
							<div className="flex flex-wrap items-center gap-1.5">
								<dt className="mr-1 shrink-0 text-gray-400 sm:w-20 sm:mr-0">Skip if</dt>
								{skip.map((s) => (
									<dd key={s}>
										<Chip tone="skip">{cap(s)}</Chip>
									</dd>
								))}
							</div>
						)}
					</dl>
				</div>

				<div className="min-w-0" onMouseLeave={() => setHover(null)}>
					<div className="grid grid-cols-[7.5rem_auto_1fr] gap-x-4 border-b border-white/10 pb-2 text-xs text-gray-500 sm:grid-cols-[7.5rem_auto_6.5rem_1fr]">
						<span>Area</span>
						<span>Level</span>
						<span className="max-sm:hidden" />
						<span className="max-sm:hidden">Driven by</span>
					</div>
					<ul className="divide-y divide-white/8">
						{PILLARS.map((p) => {
							const drivers = F.pillarDrivers(t, p).slice(0, 2)
							const open = active === p
							return (
								<li key={p} className="relative" onMouseEnter={() => setHover(p)}>
									<button
										type="button"
										aria-expanded={open}
										aria-controls={`fp-table-${p}`}
										onClick={() => setPinned(pinned === p ? null : p)}
										onFocus={() => setHover(p)}
										onKeyDown={(e) => {
											if (e.key === "Escape") {
												setPinned(null)
												setHover(null)
											}
										}}
										className={`grid w-full cursor-pointer grid-cols-[7.5rem_auto_1fr] items-center gap-x-4 gap-y-1 rounded-lg px-1 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-amber-300 sm:grid-cols-[7.5rem_auto_6.5rem_1fr] ${open ? "bg-white/5" : "hover:bg-white/3"}`}
									>
										<span className="flex items-center gap-2 font-semibold text-gray-100">
											<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
											{p}
										</span>
										<Meter tier={tiers[p]} p={p} />
										<span className="font-medium max-sm:justify-self-end" style={{ color: HEX[p] }}>
											{AREA_WORD[p][tiers[p]]}
										</span>
										<span className="truncate text-gray-400 max-sm:col-span-3 max-sm:pl-7 max-sm:text-xs">
											{drivers.map((d) => traitLabel(d.key)).join(" · ")}
										</span>
									</button>
									<div
										id={`fp-table-${p}`}
										role="region"
										aria-label={`${p} traits`}
										className={`z-20 rounded-xl border border-white/10 bg-stone-900 p-4 shadow-2xl transition-[opacity,transform] duration-150 motion-reduce:transition-none sm:absolute sm:right-0 sm:top-full sm:w-80 ${
											open ? "visible translate-y-0 opacity-100 max-sm:mb-3" : "invisible -translate-y-1 opacity-0 max-sm:hidden"
										}`}
									>
										<p className="mb-2 text-sm font-semibold text-white">{F.pillarBrief(t, p).verdict}</p>
										<DriverBars t={t} p={p} compact />
										{pinned === p && (
											<div className="mt-4 [&_a]:px-3 [&_a]:py-1 [&_a]:text-xs">
												<MoreLinks t={t} p={p} />
											</div>
										)}
									</div>
								</li>
							)
						})}
					</ul>
					<p className="mt-2 text-xs text-gray-500">Select a row to see what drives it.</p>
				</div>
			</div>
		</div>
	)
}
