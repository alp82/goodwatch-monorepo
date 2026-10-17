// PROTOTYPE - throwaway.
// Mixing desk: the six areas and four two-ended readings as faders with LED meters and a word each; touch a fader for its traits.
import { useEffect, useRef, useState } from "react"
import { DriverBars, HEX, MoreLinks, type Pillar, PILLARS, Verdict } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, tagline } from "./strip-parts"
import { AREA_WORD, GoodForLine, type Key, PHONE_WORD, SCALES, type Scale, TraitBars, wordAt } from "./versus-parts"

type Channel =
	| { kind: "area"; id: Pillar; label: string; color: string; v: number; word: string; tier: number }
	| { kind: "scale"; id: string; label: string; color: string; v: number; word: string; sc: Scale }

type Phase = "ssr" | "armed" | "live"

const Ticks = () => (
	<span className="absolute inset-y-0 right-0 flex flex-col justify-between py-[7px]" aria-hidden="true">
		{[0, 1, 2, 3, 4].map((i) => (
			<span key={i} className={`h-px ${i === 2 ? "w-2 bg-white/30" : "w-1.5 bg-white/15"}`} />
		))}
	</span>
)

function Fader({ c, phase, delay, on, onPick }: { c: Channel; phase: Phase; delay: number; on: boolean; onPick: () => void }) {
	const v = phase === "armed" ? 0 : c.v
	const lit = c.kind === "area" ? c.tier : -1
	const dot = c.kind === "scale" ? Math.min(4, Math.floor(c.v * 4.999)) : -1
	return (
		<button
			type="button"
			aria-pressed={on}
			aria-label={`${c.label}: ${c.word}${c.kind === "scale" ? `, between ${c.sc.left.toLowerCase()} and ${c.sc.right.toLowerCase()}` : ""}`}
			onClick={onPick}
			className={`group flex min-w-0 cursor-pointer flex-col items-center rounded-lg px-0.5 pb-2 pt-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
				on ? "bg-white/8" : "hover:bg-white/4"
			}`}
		>
			{/* Top pole of a two-ended reading */}
			<span className={`h-4 text-[10px] leading-4 text-gray-500 ${c.kind === "area" ? "max-sm:hidden" : ""}`}>{c.kind === "scale" ? c.sc.right : ""}</span>
			<span className="relative mt-1 flex h-[var(--h)] w-12 justify-center">
				{/* LED column */}
				<span className="absolute inset-y-0 left-0.5 flex w-1.5 flex-col-reverse gap-[3px] py-0.5" aria-hidden="true">
					{(c.kind === "area" ? [0, 1, 2, 3] : [0, 1, 2, 3, 4]).map((i) => {
						const glow = c.kind === "area" ? i < lit : i === dot
						return (
							<span
								key={i}
								className="w-full flex-1 rounded-[2px]"
								style={{
									background: glow ? c.color : "rgba(255,255,255,.07)",
									boxShadow: glow ? `0 0 6px ${c.color}` : undefined,
									opacity: glow && c.kind === "area" ? 0.55 + i * 0.15 : 1,
								}}
							/>
						)
					})}
				</span>
				{/* Slot */}
				<span className="h-full w-1.5 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,.9),0_0_0_1px_rgba(255,255,255,.06)]" aria-hidden="true" />
				{c.kind === "scale" && <span className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 bg-white/20" aria-hidden="true" />}
				<Ticks />
				{/* Knob */}
				<span
					aria-hidden="true"
					className={`absolute left-1/2 top-0 -ml-[15px] h-4 w-[30px] rounded-[3px] shadow-[0_3px_6px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.35)] will-change-transform group-hover:brightness-125 ${
						phase === "live" ? "transition-transform duration-[900ms] ease-[cubic-bezier(.2,.9,.25,1.15)] motion-reduce:transition-none" : ""
					}`}
					style={{
						transform: `translateY(calc(${1 - v} * (var(--h) - 16px)))`,
						transitionDelay: phase === "live" ? `${delay}ms` : undefined,
						background: "linear-gradient(180deg,#d6d3d1,#78716c 55%,#57534e)",
					}}
				>
					<span className="absolute inset-x-1 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ background: c.color }} />
				</span>
			</span>
			<span className={`h-4 text-[10px] leading-4 text-gray-500 ${c.kind === "area" ? "max-sm:hidden" : ""}`}>{c.kind === "scale" ? c.sc.left : ""}</span>
			<span className="mt-1.5 w-full text-center text-[11px] font-semibold leading-tight tracking-tight text-white sm:text-sm sm:tracking-normal">
				<span className="sm:hidden">{PHONE_WORD[c.word] ?? c.word}</span>
				<span className="max-sm:hidden">{c.word}</span>
			</span>
			<span
				className="mt-1 rounded-[3px] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider"
				style={{ background: `color-mix(in srgb, ${c.color} 22%, #1c1917)`, color: `color-mix(in srgb, ${c.color} 55%, white)` }}
			>
				{c.label}
			</span>
		</button>
	)
}

function useEntrance() {
	const ref = useRef<HTMLDivElement>(null)
	const [phase, setPhase] = useState<Phase>("ssr")
	useEffect(() => {
		const el = ref.current
		if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		// Already on screen when the page loads: leave the knobs where they are.
		const r = el.getBoundingClientRect()
		if (r.top < window.innerHeight - r.height * 0.4 && r.bottom > 0) return
		setPhase("armed")
		const io = new IntersectionObserver(
			(es) => {
				if (es.some((e) => e.isIntersecting)) {
					io.disconnect()
					// Two frames so the armed position paints before the slide.
					requestAnimationFrame(() => requestAnimationFrame(() => setPhase("live")))
				}
			},
			{ threshold: 0.4 },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])
	return { ref, phase }
}

function Detail({ t, c }: { t: F.TitleInput; c: Channel }) {
	const s = t.fingerprint.scores
	if (c.kind === "area")
		return (
			<div className="space-y-4">
				<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.color }}>
					<span aria-hidden="true">{PILLAR_CONFIG[c.id].emoji}</span> {c.id} · {c.word}
				</p>
				<Verdict t={t} p={c.id} size="lg" />
				<DriverBars t={t} p={c.id} compact />
				<MoreLinks t={t} p={c.id} />
			</div>
		)
	const keys = [...c.sc.keys].sort((a, b) => s[b] - s[a]).slice(0, 3) as Key[]
	return (
		<div className="space-y-4">
			<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.color }}>
				{c.label} · {c.word}
			</p>
			<p className="text-lg font-semibold leading-snug text-white">
				{c.word}, on a scale from {c.sc.left.toLowerCase()} to {c.sc.right.toLowerCase()}.
			</p>
			<TraitBars keys={keys} s={s} color={c.color} />
		</div>
	)
}

export default function Mixer({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const [pick, setPick] = useState<string | null>(null)
	const { ref, phase } = useEntrance()
	const areas: Channel[] = PILLARS.map((p) => ({
		kind: "area",
		id: p,
		label: p,
		color: HEX[p],
		v: tiers[p] / 4,
		word: AREA_WORD[p][tiers[p]],
		tier: tiers[p],
	}))
	const scales: Channel[] = SCALES.map((sc) => {
		const v = sc.value(s)
		return { kind: "scale", id: sc.name, label: sc.name, color: HEX[sc.area], v, word: wordAt(sc, v), sc }
	})
	const chosen = [...areas, ...scales].find((c) => c.id === pick)
	const bank = (cs: Channel[], offset: number) =>
		cs.map((c, i) => (
			<Fader key={c.id} c={c} phase={phase} delay={(i + offset) * 60} on={pick === c.id} onPick={() => setPick(pick === c.id ? null : c.id)} />
		))

	return (
		<div onKeyDown={(e) => e.key === "Escape" && setPick(null)}>
			<SectionTitle t={t} />
			<div className="mt-5 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-10">
				<div
					ref={ref}
					className="rounded-2xl border border-white/10 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_10px_30px_rgba(0,0,0,.4)] [--h:96px] sm:p-3 sm:[--h:120px]"
					style={{ background: "linear-gradient(180deg,#232120 0%,#141211 100%)" }}
				>
					{/* Display */}
					<div className="mb-2 rounded-lg border border-black/60 bg-[#0d0f0c] px-3 py-2 shadow-[inset_0_1px_4px_rgba(0,0,0,.8)]">
						<p className="truncate text-sm font-semibold text-amber-300 [text-shadow:0_0_8px_rgba(252,211,77,.35)]">
							{chosen ? `${chosen.label}: ${chosen.word}` : `${tagline(t, media)}`}
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<div className="grid grid-cols-6 sm:flex sm:gap-0.5">{bank(areas, 0)}</div>
						<span className="hidden w-px self-stretch bg-white/10 sm:block" aria-hidden="true" />
						<span className="h-px bg-white/10 sm:hidden" aria-hidden="true" />
						<div className="grid grid-cols-4 sm:flex sm:gap-0.5">{bank(scales, 6)}</div>
					</div>
				</div>

				<div className="min-w-0 lg:pt-1">
					{chosen ? (
						<div key={chosen.id} className="animate-[mxIn_160ms_ease-out]">
							<style>{"@keyframes mxIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
							<Detail t={t} c={chosen} />
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-lg font-semibold leading-snug text-white sm:text-xl">{F.summary(t)}</p>
							<GoodForLine t={t} />
							<p className="text-sm text-gray-500">Touch a fader to see the traits behind it.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
