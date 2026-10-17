// PROTOTYPE - throwaway.
// Trio with the band turned into a tall barcode rail on the left (heights by strength, labels beside); the headline and details to its right swap on selection. Horizontal on phones.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useRef, useState } from "react"
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { AreaDetails, AreaHeadline, Glow, GoodFor, Headline, SliderGroups, Stack, Stripes, areaLabel, nextArea, richHeadline } from "./trioscrub-parts"
import { AREA_WORD } from "./versus-parts"

export default function TrioRail({ t }: VariantProps) {
	const [sel, setSel] = useState<Pillar | null>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	const segs = useRef<Partial<Record<Pillar, HTMLButtonElement>>>({})
	const toggle = (p: Pillar) => setSel((s) => (s === p ? null : p))
	const lit = (p: Pillar) => hover === p || sel === p

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the section resets
		<div
			onKeyDown={(e) => {
				if (e.key === "Escape" && sel) {
					e.stopPropagation()
					const p = sel
					setSel(null)
					segs.current[p]?.focus()
				}
			}}
		>
			<div className="flex items-center justify-between gap-3">
				<SectionTitle t={t} />
				<button
					type="button"
					onClick={() => setSel(null)}
					tabIndex={sel ? 0 : -1}
					aria-hidden={!sel}
					className={`flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 transition-opacity duration-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300 ${
						sel ? "opacity-100" : "pointer-events-none opacity-0"
					}`}
				>
					<XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
					<span className="max-sm:hidden">Whole fingerprint</span>
					<span className="sm:hidden">All</span>
				</button>
			</div>

			<div className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-[9.5rem_minmax(0,1fr)]">
				{/* Rail: a column of segments from md up, a band on phones. */}
				<div
					role="toolbar"
					aria-orientation="vertical"
					aria-label="Fingerprint areas. Arrow keys move between areas."
					className="flex gap-[3px] md:flex-col"
					onPointerLeave={() => setHover(null)}
					onKeyDown={(e) => {
						const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0
						const from = ((e.target as HTMLElement).dataset.seg as Pillar | undefined) ?? sel
						const p = d ? nextArea(from, d) : e.key === "Home" ? PILLARS[0] : e.key === "End" ? PILLARS[PILLARS.length - 1] : null
						if (!p) return
						e.preventDefault()
						// Keep the page's prototype switcher (window arrow keys) out of it.
						e.stopPropagation()
						setSel(p)
						segs.current[p]?.focus()
					}}
				>
					{PILLARS.map((p, i) => {
						const on = sel === p
						const first = i === 0
						const last = i === PILLARS.length - 1
						return (
							<button
								key={p}
								ref={(el) => {
									if (el) segs.current[p] = el
								}}
								type="button"
								data-seg={p}
								aria-pressed={on}
								aria-label={areaLabel(t, p)}
								tabIndex={(sel ?? PILLARS[0]) === p ? 0 : -1}
								onClick={() => toggle(p)}
								onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p)}
								onFocus={() => setHover(p)}
								onBlur={() => setHover(null)}
								className="group relative flex min-w-[2.6rem] cursor-pointer flex-col text-left focus-visible:outline-none md:min-h-[2.6rem] md:flex-row md:items-stretch md:gap-3"
								// Stronger areas take visibly more of the rail than in the band.
								style={{ flex: `${t.fingerprint.pillars[p] + 0.6} 1 0%` }}
							>
								<span className="relative block h-6 w-full md:h-auto md:w-9 md:shrink-0">
									<Stripes
										t={t}
										p={p}
										className={`h-full w-full md:hidden ${first ? "rounded-l-md" : ""} ${last ? "rounded-r-md" : ""}`}
									/>
									<Stripes
										t={t}
										p={p}
										dir="col"
										className={`h-full w-full max-md:hidden ${first ? "rounded-t-md" : ""} ${last ? "rounded-b-md" : ""}`}
									/>
									<Glow
										p={p}
										on={lit(p)}
										strong={on}
										className={`${first ? "max-md:rounded-l-lg md:rounded-t-lg" : ""} ${last ? "max-md:rounded-r-lg md:rounded-b-lg" : ""}`}
									/>
									<span
										aria-hidden="true"
										className="pointer-events-none absolute -inset-[5px] rounded-lg border-2 border-amber-300 opacity-0 group-focus-visible:opacity-100"
									/>
								</span>
								{/* Selection mark: under the segment on phones, a notch beside it from md up. */}
								<span
									aria-hidden="true"
									className={`mt-1.5 block h-0.5 w-full origin-left rounded-full transition-transform duration-200 md:hidden ${on ? "scale-x-100" : "scale-x-0"}`}
									style={{ background: HEX[p] }}
								/>
								<span className="min-w-0 md:flex md:flex-col md:justify-center">
									<span
										className="mt-1 block truncate text-xs transition-colors duration-150 md:mt-0 md:text-[13px]"
										style={{ color: lit(p) ? HEX[p] : "#9ca3af" }}
									>
										<span aria-hidden="true" className="max-md:hidden">
											{PILLAR_CONFIG[p].emoji}{" "}
										</span>
										{p}
									</span>
									<span
										className={`block truncate text-sm font-semibold transition-colors duration-150 max-md:hidden ${lit(p) ? "text-white" : "text-gray-400"}`}
									>
										{AREA_WORD[p][t.fingerprint.pillars[p]]}
									</span>
								</span>
								<span
									aria-hidden="true"
									className={`absolute -right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 rounded-[2px] transition-opacity duration-200 max-md:hidden ${on ? "opacity-100" : "opacity-0"}`}
									style={{ background: HEX[p] }}
								/>
							</button>
						)
					})}
				</div>

				<div className="flex min-w-0 flex-col">
					<Stack
						active={sel ?? "all"}
						slide
						className="text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[2.1rem]"
						items={[
							[
								"all",
								<p key="all">
									<Headline bits={richHeadline(t)} hot={hover} />
								</p>,
							],
							...PILLARS.map((p) => [p, <AreaHeadline key={p} t={t} p={p} />] as [string, ReactNode]),
						]}
					/>
					<Stack
						active={sel ?? "all"}
						slide
						className="mt-6"
						items={[
							[
								"all",
								<div key="all">
									<SliderGroups t={t} hot={hover} onHover={setHover} onPick={toggle} layout="wide" />
									<GoodFor t={t} className="mt-4" />
								</div>,
							],
							...PILLARS.map((p) => [p, <AreaDetails key={p} t={t} p={p} three />] as [string, ReactNode]),
						]}
					/>
				</div>
			</div>
		</div>
	)
}
