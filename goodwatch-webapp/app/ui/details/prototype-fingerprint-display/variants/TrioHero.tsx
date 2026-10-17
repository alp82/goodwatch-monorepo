// PROTOTYPE - throwaway.
// The band as the hero: a tall, lit band with the area words on it, the composed headline large under it, details and sliders below that swap in place.
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import {
	AllButton,
	type AreaState,
	bandWord,
	phoneWord,
	SliderGroups,
	Swap,
	areaStripes,
	detailPanes,
	headlinePanes,
	hoverProps,
	shade,
	useArea,
} from "./triohero-parts"

const KEYFRAMES =
	"@keyframes thRise{from{opacity:0;transform:translateY(10px) scaleY(.35)}to{opacity:1;transform:none}}" +
	"@keyframes thSheen{0%{opacity:0;transform:translateX(-60%)}15%{opacity:1}100%{opacity:0;transform:translateX(160%)}}" +
	"@keyframes thFade{from{opacity:0}to{opacity:1}}"

function HeroBand({ t, a }: { t: F.TitleInput; a: AreaState }) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	return (
		<div className="relative">
			<style>{KEYFRAMES}</style>
			{/* Soft colored glow under the band, static. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-6 top-8 h-12 opacity-40 blur-2xl motion-safe:animate-[thFade_1.2s_ease-out_both]"
				style={{ background: `linear-gradient(90deg, ${PILLARS.map((p) => HEX[p]).join(", ")})` }}
			/>
			<div className="relative flex gap-[3px]" role="group" aria-label="Areas">
				{PILLARS.map((p, i) => {
					const on = a.sel === p
					const lit = a.focus === p
					const word = bandWord(p, tiers[p])
					return (
						<button
							key={p}
							type="button"
							aria-pressed={on}
							aria-label={`${p}: ${word.toLowerCase()}`}
							data-th-area={p}
							{...hoverProps(a, p)}
							onClick={() => a.pick(p)}
							className="group relative flex min-w-0 flex-1 cursor-pointer flex-col text-left focus-visible:outline-none sm:min-w-[4rem] sm:[flex:var(--f)_1_0%]"
							style={{ "--f": tiers[p] + 1.5 } as React.CSSProperties}
						>
							<span
								className="block w-full origin-bottom motion-safe:animate-[thRise_700ms_cubic-bezier(.2,.8,.2,1)_both]"
								style={{ animationDelay: `${i * 70}ms` }}
							>
							<span className={`relative block h-14 w-full transition-transform duration-300 ease-out sm:h-[4.25rem] ${on ? "-translate-y-1" : ""}`}>
								<span
									aria-hidden="true"
									className={`absolute inset-0 flex overflow-hidden shadow-[0_14px_30px_-14px_rgba(0,0,0,.95)] ${i === 0 ? "rounded-l-2xl" : "rounded-l-[4px]"} ${i === PILLARS.length - 1 ? "rounded-r-2xl" : "rounded-r-[4px]"}`}
								>
									{areaStripes(p, s, t.title).map((x) => (
										<span key={x.id} className="h-full" style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
									))}
									{/* Depth: top light, bottom shade, inner edge. */}
									<span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.03)_32%,transparent_55%,rgba(0,0,0,.45))]" />
									<span className="absolute inset-x-0 top-0 h-px bg-white/30" />
									<span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
									{/* Hover / selected light. */}
									<span
										className={`absolute inset-0 transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
										style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${HEX[p]} 35%, transparent), transparent 70%)` }}
									/>
									<span
										className={`absolute inset-0 rounded-[inherit] transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
										style={{ boxShadow: `inset 0 0 0 2px ${HEX[p]}, inset 0 0 18px color-mix(in srgb, ${HEX[p]} 45%, transparent)` }}
									/>
									<span className="absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-inset ring-amber-300 group-focus-visible:opacity-100" />
								</span>
								<span className="relative flex h-full flex-col justify-end px-0.5 pb-1.5 text-center sm:px-3 sm:pb-2 sm:text-left">
									<span className="truncate text-[11px] font-bold leading-tight tracking-tight text-white sm:tracking-normal [text-shadow:0_1px_6px_rgba(0,0,0,.9)] sm:text-[17px]">
										<span className="sm:hidden">{phoneWord(p, tiers[p])}</span>
										<span className="max-sm:hidden">{word}</span>
									</span>
								</span>
							</span>
							</span>
							<span className="mt-2 flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className={`h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 ${on ? "scale-100" : "scale-0"}`}
									style={{ background: HEX[p] }}
								/>
								<span
									className={`truncate text-[11px] transition-colors duration-200 sm:text-xs ${lit ? "" : "text-gray-400"}`}
									style={lit ? { color: HEX[p] } : undefined}
								>
									<span aria-hidden="true" className="max-sm:hidden">
										{PILLAR_CONFIG[p].emoji}{" "}
									</span>
									{p}
								</span>
							</span>
						</button>
					)
				})}
				{/* One sheen pass across the whole band after it rises. */}
				<span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-14 overflow-hidden rounded-2xl sm:h-[4.25rem] motion-reduce:hidden">
					<span className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,.22)_50%,transparent_80%)] opacity-0 motion-safe:animate-[thSheen_1.4s_ease-out_650ms_both]" />
				</span>
			</div>
		</div>
	)
}

export default function TrioHero({ t, media }: VariantProps) {
	const a = useArea()
	const active = a.sel ?? "all"
	const heads = headlinePanes(t, media, {
		lineClass: "text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2rem] lg:text-[2.25rem]",
	})
	const details = detailPanes(t, media, "Tap an area on the band, or a slider, to see what drives it.")
	return (
		<div onKeyDown={a.onKeyDown}>
			<div className="flex items-center justify-between gap-3">
				<SectionTitle t={t} />
				<AllButton a={a} />
			</div>

			<div className="mt-4">
				<HeroBand t={t} a={a} />
			</div>

			{/* Desktop: headline full width, details beside the sliders. */}
			<div className="max-lg:hidden">
				<Swap active={active} className="mt-5" panes={heads} />
				<div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-14 [&>*]:min-w-0">
					<Swap active={active} panes={details} />
					<SliderGroups t={t} a={a} compact />
				</div>
			</div>
			{/* Phones and tablets: headline and details swap together, so the reserved height is one tallest pair. */}
			<div className="lg:hidden">
				<Swap
					active={active}
					className="mt-5"
					panes={heads.map((h, i) => ({
						key: h.key,
						node: (
							<>
								{h.node}
								<div className="mt-5">{details[i].node}</div>
							</>
						),
					}))}
				/>
				<SliderGroups t={t} a={a} compact className="mt-7" />
			</div>
		</div>
	)
}
