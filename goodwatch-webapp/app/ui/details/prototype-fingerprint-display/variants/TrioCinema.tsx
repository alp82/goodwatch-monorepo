// PROTOTYPE - throwaway.
// Bolder trio: the band as a strip of film with one frame per area, the headline as a title card, details and sliders in a viewfinder frame below.
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { AllButton, type AreaState, SliderGroups, Swap, areaStripes, bandWord, detailPanes, headlinePanes, hoverProps, phoneWord, shade, useArea } from "./triohero-parts"

const KEYFRAMES =
	"@keyframes tcRoll{from{transform:translateX(-28px);opacity:0}to{transform:none;opacity:1}}" +
	"@keyframes tcExpose{0%{opacity:0}35%{opacity:.75}50%{opacity:.35}100%{opacity:1}}"

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
const HOLES = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='14'%3E%3Crect x='6' y='3.5' width='8' height='7' rx='1.6' fill='%230c0a09' stroke='%23ffffff' stroke-opacity='.07'/%3E%3C/svg%3E")`

function Rail() {
	return <span aria-hidden="true" className="block h-3.5 sm:h-4" style={{ backgroundImage: HOLES, backgroundRepeat: "repeat-x", backgroundPosition: "center", backgroundSize: "20px 14px" }} />
}

function Frame({ t, p, i, a }: { t: F.TitleInput; p: Pillar; i: number; a: AreaState }) {
	const tier = t.fingerprint.pillars[p]
	const on = a.sel === p
	const lit = a.focus === p
	return (
		<button
			type="button"
			aria-pressed={on}
			aria-label={`${p}: ${bandWord(p, tier).toLowerCase()}`}
			data-th-area={p}
			{...hoverProps(a, p)}
			onClick={() => a.pick(p)}
			className={`group relative min-w-0 flex-1 cursor-pointer focus-visible:outline-none ${on ? "z-10" : ""}`}
		>
			<span className="block motion-safe:animate-[tcExpose_900ms_ease-out_both]" style={{ animationDelay: `${250 + i * 110}ms` }}>
				<span
					className={`relative block h-[4.25rem] overflow-hidden rounded-[5px] transition-transform duration-300 ease-out sm:h-[5rem] ${on ? "scale-[1.045]" : ""}`}
					style={{ boxShadow: on ? `0 0 0 2px ${HEX[p]}, 0 0 26px -4px ${HEX[p]}` : "0 0 0 1px rgba(255,255,255,.06)" }}
				>
					<span aria-hidden="true" className="absolute inset-0 flex">
						{areaStripes(p, t.fingerprint.scores, t.title).map((x) => (
							<span key={x.id} className="h-full" style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
						))}
					</span>
					{/* Vignette, like light falling off at the edge of a frame. */}
					<span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_45%,transparent_35%,rgba(0,0,0,.72))]" />
					{/* Projector light on hover and selection. */}
					<span
						aria-hidden="true"
						className={`absolute inset-0 transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
						style={{ background: `radial-gradient(90% 80% at 50% 40%, rgba(255,250,235,.28), color-mix(in srgb, ${HEX[p]} 20%, transparent) 60%, transparent)` }}
					/>
					<span aria-hidden="true" className="absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-inset ring-amber-300 group-focus-visible:opacity-100" />
					<span aria-hidden="true" className="absolute left-1.5 top-1 font-mono text-[9px] tracking-widest text-white/45 max-sm:hidden">
						{String(i + 1).padStart(2, "0")}
					</span>
					<span className="relative flex h-full flex-col items-center justify-end px-0.5 pb-1.5 text-center leading-tight sm:pb-2.5">
						<span className="max-w-full truncate text-[9px] uppercase tracking-[.12em] text-white/70 sm:text-[10px]">
							<span aria-hidden="true" className="max-sm:hidden">
								{PILLAR_CONFIG[p].emoji}{" "}
							</span>
							{p}
						</span>
						<span className="max-w-full truncate text-[11px] font-bold tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,.9)] sm:text-[17px] sm:tracking-normal">
							<span className="sm:hidden">{phoneWord(p, tier)}</span>
							<span className="max-sm:hidden">{bandWord(p, tier)}</span>
						</span>
					</span>
				</span>
			</span>
		</button>
	)
}

function FilmStrip({ t, a }: { t: F.TitleInput; a: AreaState }) {
	return (
		<div
			className="relative overflow-hidden rounded-lg bg-[#17130f] shadow-[0_18px_40px_-20px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.05)] motion-safe:animate-[tcRoll_700ms_cubic-bezier(.2,.8,.2,1)_both]"
			role="group"
			aria-label="Areas"
		>
			<style>{KEYFRAMES}</style>
			<Rail />
			<div className="flex gap-1 px-1.5 sm:gap-1.5 sm:px-2">
				{PILLARS.map((p, i) => (
					<Frame key={p} t={t} p={p} i={i} a={a} />
				))}
			</div>
			<Rail />
			{/* Grain over the whole strip, static. */}
			<span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.13] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
		</div>
	)
}

// Viewfinder corners for the frame below.
function Corners({ color }: { color: string }) {
	const c = "absolute h-4 w-4 border-solid"
	const st = { borderColor: color }
	return (
		<span aria-hidden="true" className="pointer-events-none absolute inset-0">
			<span className={`${c} left-0 top-0 rounded-tl-md border-l-2 border-t-2`} style={st} />
			<span className={`${c} right-0 top-0 rounded-tr-md border-r-2 border-t-2`} style={st} />
			<span className={`${c} bottom-0 left-0 rounded-bl-md border-b-2 border-l-2`} style={st} />
			<span className={`${c} bottom-0 right-0 rounded-br-md border-b-2 border-r-2`} style={st} />
		</span>
	)
}

export default function TrioCinema({ t, media }: VariantProps) {
	const a = useArea()
	const active = a.sel ?? "all"
	const color = a.sel ? HEX[a.sel] : "rgba(255,255,255,.22)"
	return (
		<div onKeyDown={a.onKeyDown}>
			<div className="flex items-center justify-between gap-3">
				<SectionTitle t={t} />
				<AllButton a={a} />
			</div>

			<div className="mt-4">
				<FilmStrip t={t} a={a} />
			</div>

			{/* Title card. */}
			<div className="relative mt-5 text-center">
				<div className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[.22em] text-gray-500">
					<span aria-hidden="true" className="h-px w-10 bg-gradient-to-r from-transparent to-white/25" />
					<Swap
						active={active}
						panes={[
							{
								key: "all",
								node: (
									<span>
										<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} /> · {t.year}
									</span>
								),
							},
							...PILLARS.map((p) => ({
								key: p,
								node: (
									<span style={{ color: HEX[p] }}>
										<span aria-hidden="true">{PILLAR_CONFIG[p].emoji} </span>
										{p}
									</span>
								),
							})),
						]}
					/>
					<span aria-hidden="true" className="h-px w-10 bg-gradient-to-l from-transparent to-white/25" />
				</div>
				<Swap
					active={active}
					className="mx-auto mt-3 max-w-4xl"
					panes={headlinePanes(t, media, {
						lineClass: "text-balance text-[1.55rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2rem] lg:text-[2.2rem]",
					})}
				/>
			</div>

			{/* The frame: details and sliders. */}
			<div className="relative mt-5 rounded-xl bg-white/[.015] p-4 sm:px-6 sm:py-5">
				<Corners color={color} />
				<div className="grid gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
					<Swap active={active} panes={detailPanes(t, media, "Tap a frame on the strip, or a slider, to see what drives it.")} />
					<SliderGroups t={t} a={a} compact />
				</div>
			</div>
		</div>
	)
}
