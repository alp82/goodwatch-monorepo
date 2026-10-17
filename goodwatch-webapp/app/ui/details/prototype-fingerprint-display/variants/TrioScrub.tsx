// PROTOTYPE - throwaway.
// Trio with a scrubbable band: a playhead follows the pointer or finger and the headline and details below preview each area live; a tap locks it.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useRef, useState } from "react"
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { AreaDetails, AreaHeadline, Glow, GoodFor, Headline, SliderGroups, Stack, Stripes, areaLabel, nextArea, richHeadline, tierFlex } from "./trioscrub-parts"
import { AREA_WORD } from "./versus-parts"

export default function TrioScrub({ t }: VariantProps) {
	const [locked, setLocked] = useState<Pillar | null>(null)
	const [preview, setPreview] = useState<Pillar | null>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	const [scrubbing, setScrubbing] = useState(false)
	const band = useRef<HTMLDivElement>(null)
	const head = useRef<HTMLSpanElement>(null)
	const segs = useRef<Partial<Record<Pillar, HTMLButtonElement>>>({})
	const down = useRef<{ x: number; moved: boolean } | null>(null)
	const shown = preview ?? locked
	const lit = shown ?? hover

	// Area under a viewport x, and the playhead moved there directly (no re-render per pixel).
	const at = (x: number): Pillar => {
		for (const p of PILLARS) {
			const r = segs.current[p]?.getBoundingClientRect()
			if (r && x <= r.right + 1) return p
		}
		return PILLARS[PILLARS.length - 1]
	}
	const moveHead = (x: number | null) => {
		const b = band.current?.getBoundingClientRect()
		if (!b || !head.current) return
		const cx = x === null ? null : Math.min(Math.max(x - b.left, 1), b.width - 1)
		head.current.style.transform = `translateX(${cx ?? 0}px)`
		head.current.style.opacity = cx === null ? "0" : "1"
	}
	const park = (p: Pillar | null) => {
		const r = p && segs.current[p]?.getBoundingClientRect()
		moveHead(r ? r.left + r.width / 2 : null)
	}
	const lock = (p: Pillar | null) => {
		setLocked(p)
		requestAnimationFrame(() => park(p))
	}
	const toggle = (p: Pillar) => lock(locked === p ? null : p)

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the section resets
		<div
			onKeyDown={(e) => {
				if (e.key === "Escape" && locked) {
					lock(null)
					e.stopPropagation()
				}
			}}
		>
			<div className="flex items-center justify-between gap-3">
				<SectionTitle t={t} />
				<button
					type="button"
					onClick={() => lock(null)}
					tabIndex={locked ? 0 : -1}
					aria-hidden={!locked}
					className={`flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-300 transition-opacity duration-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300 ${
						locked ? "opacity-100" : "pointer-events-none opacity-0"
					}`}
				>
					<XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
					<span className="max-sm:hidden">Whole fingerprint</span>
					<span className="sm:hidden">All</span>
				</button>
			</div>

			{/* Band: pointer and finger scrub across it; touch-action keeps vertical page scroll. */}
			<div
				ref={band}
				role="toolbar"
				aria-label="Fingerprint areas. Arrow keys move between areas."
				className="relative mt-4 flex touch-pan-y select-none gap-[3px]"
				onPointerDown={(e) => {
					down.current = { x: e.clientX, moved: false }
					if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId)
					setScrubbing(true)
					setPreview(at(e.clientX))
					moveHead(e.clientX)
				}}
				onPointerMove={(e) => {
					if (e.pointerType !== "mouse" && !down.current) return
					if (down.current && Math.abs(e.clientX - down.current.x) > 6) down.current.moved = true
					setScrubbing(true)
					setPreview(at(e.clientX))
					moveHead(e.clientX)
				}}
				onPointerUp={(e) => {
					const d = down.current
					down.current = null
					if (!d) return
					const p = at(e.clientX)
					// A tap toggles; a finger drag picks where it lifts.
					if (!d.moved) toggle(p)
					else lock(p)
					if (e.pointerType !== "mouse") {
						setPreview(null)
						setScrubbing(false)
					}
				}}
				onPointerCancel={() => {
					down.current = null
					setPreview(null)
					setScrubbing(false)
					park(locked)
				}}
				onPointerLeave={(e) => {
					if (e.pointerType !== "mouse") return
					setPreview(null)
					setScrubbing(false)
					park(locked)
				}}
				onKeyDown={(e) => {
					const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
					// From the focused segment; the first arrow press selects the neighbour of what has focus.
					const from = ((e.target as HTMLElement).dataset.seg as Pillar | undefined) ?? locked
					const p = d ? nextArea(from, d) : e.key === "Home" ? PILLARS[0] : e.key === "End" ? PILLARS[PILLARS.length - 1] : null
					if (!p) return
					e.preventDefault()
					// Keep the page's prototype switcher (window arrow keys) out of it.
					e.stopPropagation()
					lock(p)
					segs.current[p]?.focus()
				}}
			>
				{PILLARS.map((p, i) => {
					const on = locked === p
					const live = lit === p
					return (
						<button
							key={p}
							ref={(el) => {
								if (el) segs.current[p] = el
							}}
							type="button"
							data-seg={p}
							tabIndex={(locked ?? PILLARS[0]) === p ? 0 : -1}
							aria-pressed={on}
							aria-label={areaLabel(t, p)}
							onFocus={() => setHover(p)}
							onBlur={() => setHover(null)}
							// Pointer taps are handled on the band; this covers Enter and Space.
							onClick={(e) => e.detail === 0 && toggle(p)}
							className="group relative flex min-w-[2.6rem] cursor-pointer flex-col py-2 text-left focus-visible:outline-none"
							style={{ flex: `${tierFlex(t, p)} 1 0%` }}
						>
							<span className="relative block w-full">
								<Stripes t={t} p={p} className={`h-5 w-full ${i === 0 ? "rounded-l-md" : ""} ${i === PILLARS.length - 1 ? "rounded-r-md" : ""}`} />
								<Glow p={p} on={live} strong={on} className={`${i === 0 ? "rounded-l-lg" : ""} ${i === PILLARS.length - 1 ? "rounded-r-lg" : ""}`} />
								<span className="pointer-events-none absolute -inset-[5px] rounded-lg border-2 border-amber-300 opacity-0 group-focus-visible:opacity-100" aria-hidden="true" />
							</span>
							<span
								aria-hidden="true"
								className={`mt-1.5 block h-0.5 w-full origin-left rounded-full transition-transform duration-200 ${on ? "scale-x-100" : "scale-x-0"}`}
								style={{ background: HEX[p] }}
							/>
							<span className="mt-1 block truncate text-xs transition-colors duration-150" style={{ color: live ? HEX[p] : "#9ca3af" }}>
								<span aria-hidden="true" className="max-sm:hidden">
									{PILLAR_CONFIG[p].emoji}{" "}
								</span>
								{p}
							</span>
							<span className={`block truncate text-[13px] font-semibold transition-colors duration-150 max-sm:hidden ${live ? "text-white" : "text-gray-500"}`}>
								{AREA_WORD[p][t.fingerprint.pillars[p]]}
							</span>
						</button>
					)
				})}
				{/* Playhead */}
				<span
					ref={head}
					aria-hidden="true"
					className={`pointer-events-none absolute left-0 top-0.5 h-8 w-0 opacity-0 ${scrubbing ? "" : "motion-safe:transition-[transform,opacity] motion-safe:duration-300"}`}
				>
					<span className="absolute -left-px top-0 h-full w-0.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,.7)]" />
					<span className="absolute -left-[4px] -top-0.5 h-2 w-2 rounded-full bg-white" />
				</span>
			</div>

			<div className="mt-4 grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div aria-live="polite" className="min-w-0">
					<Stack
						active={shown ?? "all"}
						ms={140}
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
					<GoodFor t={t} className="mt-5 max-lg:hidden" />
				</div>
				<Stack
					active={shown ?? "all"}
					ms={140}
					items={[
						["all", <SliderGroups key="all" t={t} hot={hover} onHover={setHover} onPick={(p) => toggle(p)} />],
						...PILLARS.map((p) => [p, <AreaDetails key={p} t={t} p={p} wide />] as [string, ReactNode]),
					]}
				/>
			</div>
			<GoodFor t={t} className="mt-5 lg:hidden" />
		</div>
	)
}
