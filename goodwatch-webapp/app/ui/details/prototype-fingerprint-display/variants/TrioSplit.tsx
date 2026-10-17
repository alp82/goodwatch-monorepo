// PROTOTYPE - throwaway.
// Mirrored trio: sliders on the left as the instrument panel, the bold readout on the right, the band as a footer strip that selects an area.
import { HEX, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { AllButton, type AreaState, SliderGroups, Swap, areaStripes, bandWord, detailPanes, headlinePanes, hoverProps, phoneWord, shade, useArea } from "./triohero-parts"

const KEYFRAMES = "@keyframes tsIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"

function FooterBand({ t, a }: { t: F.TitleInput; a: AreaState }) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	return (
		<div className="flex gap-[3px]" role="group" aria-label="Areas">
			<style>{KEYFRAMES}</style>
			{PILLARS.map((p, i) => {
				const on = a.sel === p
				const lit = a.focus === p
				return (
					<button
						key={p}
						type="button"
						aria-pressed={on}
						aria-label={`${p}: ${bandWord(p, tiers[p]).toLowerCase()}`}
						data-th-area={p}
						{...hoverProps(a, p)}
						onClick={() => a.pick(p)}
						className="group relative min-w-0 flex-1 cursor-pointer focus-visible:outline-none sm:[flex:var(--f)_1_0%] motion-safe:animate-[tsIn_500ms_ease-out_both]"
						style={{ "--f": tiers[p] + 1.5, animationDelay: `${i * 60}ms` } as React.CSSProperties}
					>
						{/* Caret pointing at the readout when selected (up on desktop, down on phones). */}
						<span
							aria-hidden="true"
							className={`absolute -top-2.5 left-1/2 h-0 w-0 max-sm:top-auto max-sm:-bottom-2.5 max-sm:rotate-180 -translate-x-1/2 border-x-[7px] border-b-[7px] border-x-transparent transition-[opacity,transform] duration-200 ${on ? "opacity-100" : "translate-y-1 opacity-0"}`}
							style={{ borderBottomColor: HEX[p] }}
						/>
						<span
							className={`relative flex h-12 items-center overflow-hidden transition-transform duration-200 sm:h-[3.25rem] ${on ? "-translate-y-0.5" : ""} ${i === 0 ? "rounded-l-xl" : "rounded-l-[3px]"} ${i === PILLARS.length - 1 ? "rounded-r-xl" : "rounded-r-[3px]"}`}
						>
							<span aria-hidden="true" className="absolute inset-0 flex">
								{areaStripes(p, s, t.title).map((x) => (
									<span key={x.id} className="h-full" style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
								))}
							</span>
							<span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,10,9,.78),rgba(12,10,9,.35)_70%,rgba(12,10,9,.15))] max-sm:bg-[linear-gradient(180deg,rgba(12,10,9,.1),rgba(12,10,9,.6))]" />
							<span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-white/25" />
							<span
								aria-hidden="true"
								className={`absolute inset-0 transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
								style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${HEX[p]} 30%, transparent), transparent)` }}
							/>
							<span
								aria-hidden="true"
								className={`absolute inset-0 rounded-[inherit] transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
								style={{ boxShadow: `inset 0 0 0 2px ${HEX[p]}` }}
							/>
							<span aria-hidden="true" className="absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-inset ring-amber-300 group-focus-visible:opacity-100" />
							<span className="relative flex min-w-0 flex-1 flex-col items-center px-0.5 leading-tight sm:items-start sm:px-3">
								<span className={`max-w-full truncate text-[10px] transition-colors sm:text-[11px] ${lit ? "text-white" : "text-gray-300"}`}>
									<span aria-hidden="true" className="max-sm:hidden">
										{PILLAR_CONFIG[p].emoji}{" "}
									</span>
									{p}
								</span>
								<span className="max-w-full truncate text-[11px] font-bold tracking-tight text-white sm:text-[15px] sm:tracking-normal">
									<span className="sm:hidden">{phoneWord(p, tiers[p])}</span>
									<span className="max-sm:hidden">{bandWord(p, tiers[p])}</span>
								</span>
							</span>
						</span>
					</button>
				)
			})}
		</div>
	)
}

export default function TrioSplit({ t, media }: VariantProps) {
	const a = useArea()
	const active = a.sel ?? "all"
	const details = detailPanes(t, media, "Tap an area on the band, or a slider, to read it here.")
	return (
		<div onKeyDown={a.onKeyDown}>
			<div className="flex items-center justify-between gap-3">
				<SectionTitle t={t} />
				<AllButton a={a} />
			</div>

			<div className="mt-5 grid gap-x-12 gap-y-6 [grid-template-areas:'band'_'read'_'panel'] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:[grid-template-areas:'panel_read'_'band_band'] [&>*]:min-w-0">
				{/* Instrument panel. */}
				<div className="relative rounded-2xl border border-white/[.07] bg-[linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01))] p-4 pb-2 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] [grid-area:panel] sm:p-5 sm:pb-3">
					<SliderGroups t={t} a={a} compact />
				</div>

				{/* Readout: headline and details swap together, so the reserved height is the tallest pair. */}
				<Swap
					active={active}
					className="[grid-area:read] lg:self-start"
					panes={headlinePanes(t, media, {
						lineClass: "text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2rem] lg:text-[2.1rem]",
					}).map((h, i) => ({
						key: h.key,
						node: (
							<>
								{h.node}
								<div className="mt-5">{details[i].node}</div>
							</>
						),
					}))}
				/>

				<div className="[grid-area:band] lg:pt-1">
					<FooterBand t={t} a={a} />
				</div>
			</div>
		</div>
	)
}
