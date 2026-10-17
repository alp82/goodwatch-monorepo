// PROTOTYPE - throwaway.
// Allsliders, polished, with a fixed-size side panel (a sticky strip on phones) that shows the strongest reading and follows hover, focus and taps.
import { XMarkIcon } from "@heroicons/react/16/solid"
import type React from "react"
import { useEffect, useState } from "react"
import { HEX } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import {
	BLURB,
	GROUPS,
	GroupHead,
	KEYFRAMES,
	MoreLinkChips,
	RowFace,
	type Scale,
	SectionTitle,
	TraitBars,
	cardStyle,
	groupOf,
	moreLinks,
	reading,
	scaleTraits,
	strongest,
} from "./slidepop-parts"

type Mode = "default" | "preview" | "pinned"

function Eyebrow({ sc, mode }: { sc: Scale; mode: Mode }) {
	return (
		<p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
			<span className="h-1.5 w-1.5 rounded-full" style={{ background: HEX[sc.area] }} aria-hidden="true" />
			{mode === "default" ? `Stands out most · ${sc.name}` : `${groupOf(sc)} · ${sc.name}`}
		</p>
	)
}

// lg and up: the tall panel beside the sliders.
function PanelFull({ sc, t, mode, onUnpin }: { sc: Scale; t: F.TitleInput; mode: Mode; onUnpin: () => void }) {
	const r = reading(sc, t)
	return (
		<div key={sc.name} className="flex h-full flex-col p-5 motion-safe:animate-[fpSwap_180ms_ease-out]">
			<div className="flex items-start justify-between gap-2">
				<Eyebrow sc={sc} mode={mode} />
				{mode === "pinned" && (
					<button type="button" onClick={onUnpin} aria-label="Back to the overview" className="-mr-1.5 -mt-1.5 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300">
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<p className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-white">{r.word}</p>
			<p className="mt-1 text-sm text-gray-400">{BLURB[sc.name]}</p>
			<div className="mt-4">
				<TraitBars sc={sc} t={t} n={3} />
			</div>
			<div className="mt-auto pt-4">
				{moreLinks(sc, t, 1).length ? (
					<MoreLinkChips links={moreLinks(sc, t, 1)} area={sc.area} size="xs" />
				) : (
					<p className="text-xs text-gray-500">{mode === "default" ? "Point at any scale to see what is behind it." : " "}</p>
				)}
			</div>
		</div>
	)
}

// Below lg: a compact strip of fixed height.
function PanelStrip({ sc, t, mode, onUnpin }: { sc: Scale; t: F.TitleInput; mode: Mode; onUnpin: () => void }) {
	const r = reading(sc, t)
	const link = moreLinks(sc, t, 1)
	return (
		<div key={sc.name} className="flex h-full flex-col px-4 py-3 motion-safe:animate-[fpSwap_180ms_ease-out]">
			<div className="flex items-start justify-between gap-2">
				<Eyebrow sc={sc} mode={mode} />
				{mode === "pinned" && (
					<button type="button" onClick={onUnpin} aria-label="Back to the overview" className="-mr-2 -mt-2 cursor-pointer rounded-full p-2 text-gray-400 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300">
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<p className="mt-0.5 truncate text-[13px] text-gray-400">
				<span className="text-lg font-semibold text-white">{r.word}</span>
				<span className="ml-2">{BLURB[sc.name]}</span>
			</p>
			<div className="mt-2 grid grid-cols-3 gap-x-3">
				{scaleTraits(sc, t, 3).map((d) => (
					<div key={d.key} className="min-w-0" aria-label={`${getFingerprintMeta(d.key).label}: ${d.score} out of 10`}>
						<p className="truncate text-xs text-gray-200">{getFingerprintMeta(d.key).label}</p>
						<div className="mt-1 h-1 rounded-full bg-white/[0.07]">
							<div className="h-1 rounded-full" style={{ width: `${d.score * 10}%`, background: HEX[sc.area] }} />
						</div>
					</div>
				))}
			</div>
			<div className="mt-auto flex items-end justify-between gap-2 overflow-hidden">
				{link.length ? <MoreLinkChips links={link} area={sc.area} size="xs" /> : <span className="text-xs text-gray-500">{mode === "default" ? "Tap any scale to see what is behind it." : ""}</span>}
			</div>
		</div>
	)
}

// The page's own sticky title bar sits under the fixed header on phones; stick the strip just below both.
function useStickTop() {
	const [top, setTop] = useState(64)
	useEffect(() => {
		const read = () => {
			const bar = document.querySelector<HTMLElement>(".sticky.top-16")
			setTop(bar ? 64 + bar.offsetHeight + 8 : 72)
		}
		read()
		window.addEventListener("resize", read)
		return () => window.removeEventListener("resize", read)
	}, [])
	return top
}

export default function SlideSide({ t }: VariantProps) {
	const best = strongest(t)
	const [hover, setHover] = useState<Scale | null>(null)
	const [pinned, setPinned] = useState<Scale | null>(null)
	const shown = hover ?? pinned ?? best
	const mode: Mode = hover && hover !== pinned ? "preview" : pinned ? "pinned" : "default"
	const stickTop = useStickTop()
	const unpin = () => setPinned(null)

	const column = (gs: typeof GROUPS) => (
		<div className="space-y-5">
			{gs.map((g) => (
				<section key={g.name}>
					<GroupHead name={g.name} />
					<ul>
						{g.scales.map((sc) => {
							const on = shown === sc
							return (
								<li key={sc.name}>
									<button
										type="button"
										aria-pressed={pinned === sc}
										aria-controls="slideside-panel"
										onPointerEnter={(e) => e.pointerType === "mouse" && setHover(sc)}
										onFocus={() => setHover(sc)}
										onBlur={() => setHover(null)}
										onClick={() => {
											setPinned(pinned === sc ? null : sc)
											setHover(null)
										}}
										className={`-mx-2.5 flex w-[calc(100%+1.25rem)] cursor-pointer rounded-xl px-2.5 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/[0.05]" : ""}`}
									>
										<RowFace sc={sc} t={t} active={on} layout="stacked" />
									</button>
								</li>
							)
						})}
					</ul>
				</section>
			))}
		</div>
	)

	return (
		<div onKeyDown={(e) => e.key === "Escape" && unpin()}>
			<style>{KEYFRAMES}</style>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-gray-300">{F.summary(t)}</p>

			<div className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18.5rem] [&>*]:min-w-0" onPointerLeave={() => setHover(null)}>
				{/* The panel's content is absolutely placed in a box of fixed size, so what it shows never changes the layout. */}
				<aside
					id="slideside-panel"
					aria-label="Reading details"
					className="sticky z-20 h-[8.75rem] overflow-hidden rounded-2xl border border-white/10 top-[var(--st)] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)] md:col-span-2 lg:relative lg:top-auto lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:h-auto lg:min-h-[20.5rem]"
					style={{ ...cardStyle(shown.area), "--st": `${stickTop}px` } as React.CSSProperties}
				>
					<div className="absolute inset-0 lg:hidden">
						<PanelStrip sc={shown} t={t} mode={mode} onUnpin={unpin} />
					</div>
					<div className="absolute inset-0 hidden lg:block">
						<PanelFull sc={shown} t={t} mode={mode} onUnpin={unpin} />
					</div>
				</aside>
				<div className="lg:col-start-1 lg:row-start-1">{column([GROUPS[0]])}</div>
				<div className="lg:col-start-2 lg:row-start-1">{column([GROUPS[1], GROUPS[2]])}</div>
			</div>
		</div>
	)
}
