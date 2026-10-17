import type * as F from "~/ui/fingerprint/fingerprintText"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { AREAS, AREA_COLOR, areaLevelWord } from "./areas"
import { areaStripes, segmentGrow, stripeColor } from "./band"
import { type AreaSelection, highlightHandlers } from "./selection"

/**
 * The band of area segments, each a button that selects its area. Nothing dims: hover glows the segment, and the
 * selected one gets a ring, a lift, and its name in its color.
 */
export default function AreaBand({
	t,
	selection: x,
}: {
	t: F.TitleInput
	selection: AreaSelection
}) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	return (
		// biome-ignore lint/a11y/useSemanticElements: a row of toggle buttons, not a form; a <fieldset> would need a legend and its own layout resets.
		<div className="flex gap-[3px]" role="group" aria-label="Fingerprint areas">
			{AREAS.map((area, i) => {
				const on = x.selected === area
				const hot = x.hovered === area
				const corners = `${i === 0 ? "rounded-l-full" : "rounded-l-[3px]"} ${
					i === AREAS.length - 1 ? "rounded-r-full" : "rounded-r-[3px]"
				}`
				const color = AREA_COLOR[area]
				return (
					<button
						key={area}
						type="button"
						data-fp-area={area}
						aria-pressed={on}
						aria-label={`${area}: ${areaLevelWord(area, tiers[area]).toLowerCase()}. ${
							on ? "Showing details, press again for all areas" : "Show details"
						}`}
						{...highlightHandlers(x, area)}
						onClick={() => x.toggle(area)}
						className="group flex min-w-[2.5rem] cursor-pointer flex-col pt-1 text-left focus-visible:outline-none"
						style={{ flex: `${segmentGrow(tiers[area])} 1 0%` }}
					>
						<span
							className={`relative block w-full transition-transform duration-200 ease-out motion-reduce:transition-none ${
								on ? "-translate-y-[3px]" : hot ? "-translate-y-px" : ""
							}`}
						>
							<span
								aria-hidden="true"
								className={`relative flex h-4 w-full overflow-hidden sm:h-[18px] ${corners}`}
							>
								{areaStripes(area, s, t.title).map((stripe) => (
									<span
										key={stripe.id}
										className="h-full"
										style={{
											flex: `${stripe.width} 1 0%`,
											background: stripeColor(color, stripe.brightness),
										}}
									/>
								))}
								<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.14),transparent_45%,rgba(0,0,0,.25))]" />
								{/* Hover brightens the stripes a touch. */}
								<span
									className={`pointer-events-none absolute inset-0 bg-white/15 mix-blend-overlay transition-opacity duration-200 motion-reduce:transition-none ${
										hot || on ? "opacity-100" : "opacity-0"
									}`}
								/>
							</span>
							{/* Glow and ring. */}
							<span
								aria-hidden="true"
								className={`pointer-events-none absolute -inset-[3px] ${corners} transition-opacity duration-200 motion-reduce:transition-none ${
									on ? "opacity-100" : hot ? "opacity-70" : "opacity-0"
								} group-focus-visible:opacity-100`}
								style={{
									boxShadow: `0 0 0 1.5px ${on ? "rgba(255,255,255,.85)" : color}, 0 0 18px -2px ${color}`,
								}}
							/>
						</span>
						<span
							className={`mt-2 block truncate text-xs ${on ? "font-semibold" : ""} ${
								hot && !on ? "text-white" : on ? "" : "text-gray-400"
							}`}
							style={on ? { color } : undefined}
						>
							<span aria-hidden="true" className="max-sm:hidden">
								{PILLAR_CONFIG[area].emoji}{" "}
							</span>
							{area}
						</span>
					</button>
				)
			})}
		</div>
	)
}
