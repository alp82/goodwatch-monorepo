// PROTOTYPE - throwaway.
// Every slider track is a small barcode of the traits behind it, lit around a clean marker; one bold versus line on top.
import { useState } from "react"
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { FloatCard, GROUPS, PairCardBody, PairText, ScaleCardBody, TWO_POLE, hash, pickPairs } from "./bandsliders-parts"
import { type Key, type Scale, reading } from "./slidestrip-parts"
import { SectionTitle, tagline } from "./strip-parts"
import { GoodForLine, areaOf } from "./versus-parts"

// Traits that pull a two-ended reading to the left end. Everything else pulls right.
const LEFT_KEYS = new Set<Key>(["slow_burn", "bleakness", "contemporary_realism", "historical", "biographical"])

// The barcode of one reading: each trait adds lines, more and brighter the higher it scores. On two-ended
// readings the left-end traits sit in the left half and the right-end traits in the right half; the lines
// between the start and the marker are lit, the rest stay faint, with a soft glow around the marker.
function trackLines(sc: Scale, t: F.TitleInput, v: number) {
	const s = t.fingerprint.scores
	const two = TWO_POLE.has(sc.name)
	const from = two ? 0.5 : 0
	const lo = Math.min(from, v)
	const hi = Math.max(from, v)
	const seed = `${t.title}:${sc.name}`
	const lines: { x: number; w: number; a: number }[] = []
	const keys = sc.keys(t)
	for (const k of keys) {
		const n = 2 + Math.round(s[k] * (keys.length > 4 ? 0.8 : 1.6))
		const [x0, x1] = two ? (LEFT_KEYS.has(k) ? [0, 0.5] : [0.5, 1]) : [0, 1]
		for (let i = 0; i < n; i++) {
			const r1 = hash(`${seed}:${k}:${i}:x`)
			const r2 = hash(`${seed}:${k}:${i}:w`)
			const x = x0 + r1 * (x1 - x0)
			lines.push({ x, w: 0.003 + r2 * 0.012 * (0.5 + s[k] / 10), a: 0.25 + (s[k] / 10) * 0.75 })
		}
	}
	// A faint even texture so empty stretches still read as part of the code.
	for (let i = 0; i < 46; i++) lines.push({ x: hash(`${seed}:bg${i}`), w: 0.002 + hash(`${seed}:bgw${i}`) * 0.006, a: 0.12 })
	return lines.map((l) => {
		const lit = l.x >= lo - 0.01 && l.x <= hi + 0.01 ? 1 : 0
		const glow = Math.exp(-(((l.x - v) / 0.12) ** 2))
		return { ...l, a: l.a * (0.16 + 0.84 * Math.max(lit * 0.85, glow)) }
	})
}

function CodeTrack({ sc, t, v, word, dim }: { sc: Scale; t: F.TitleInput; v: number; word: string; dim: boolean }) {
	const c = HEX[sc.area]
	return (
		<span
			role="img"
			aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
			className={`relative block h-6 transition-opacity duration-200 sm:h-7 ${dim ? "opacity-25" : ""}`}
		>
			<span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[5px] bg-white/[.035]">
				<svg viewBox="0 0 1000 10" preserveAspectRatio="none" className="h-full w-full">
					{trackLines(sc, t, v).map((l, i) => (
						<rect key={i} x={l.x * 1000} width={Math.max(2, l.w * 1000)} y={0} height={10} fill={c} fillOpacity={l.a} />
					))}
				</svg>
				<span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.08),transparent_40%,transparent_60%,rgba(0,0,0,.35))]" />
				{TWO_POLE.has(sc.name) && <span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />}
			</span>
			<span
				aria-hidden="true"
				className="absolute -inset-y-1 w-[3px] -translate-x-1/2 rounded-full bg-white"
				style={{ left: `calc(4px + ${v} * (100% - 8px))`, boxShadow: `0 0 0 2px #0c0a09, 0 0 14px 2px color-mix(in srgb, ${c} 70%, transparent)` }}
			/>
		</span>
	)
}

function Row({
	sc,
	t,
	focus,
	on,
	onHover,
	onPick,
}: {
	sc: Scale
	t: F.TitleInput
	focus: Pillar | null
	on: boolean
	onHover: (p: Pillar | null) => void
	onPick: (el: HTMLElement) => void
}) {
	const r = reading(sc, t)
	const dim = focus !== null && focus !== sc.area
	return (
		<li className="min-w-0">
			<button
				type="button"
				data-fp-trigger
				aria-haspopup="dialog"
				aria-expanded={on}
				onPointerEnter={(e) => e.pointerType === "mouse" && onHover(sc.area)}
				onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
				onFocus={() => onHover(sc.area)}
				onBlur={() => onHover(null)}
				onClick={(e) => onPick(e.currentTarget)}
				className={`-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 pb-1.5 pt-2 text-left transition-colors hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/[.06]" : ""}`}
			>
				<span className={`flex flex-wrap items-baseline justify-between gap-x-3 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}>
					<span className="text-[13px] text-gray-400">{sc.name}</span>
					<span className="text-sm font-semibold text-white">{r.word}</span>
				</span>
				<span className="mt-2 block">
					<CodeTrack sc={sc} t={t} v={r.v} word={r.word} dim={dim} />
				</span>
				<span aria-hidden="true" className={`mt-1.5 flex justify-between gap-2 text-[11px] text-gray-500 transition-opacity ${dim ? "opacity-40" : ""}`}>
					<span className={r.near === "left" ? "text-gray-300" : ""}>{sc.left}</span>
					<span className={r.near === "right" ? "text-gray-300" : ""}>{sc.right}</span>
				</span>
			</button>
		</li>
	)
}

type Open = { kind: "scale"; sc: Scale; el: HTMLElement } | { kind: "pair"; el: HTMLElement } | null

export default function Stripes({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const [open, setOpen] = useState<Open>(null)
	const [hover, setHover] = useState<Pillar | null>(null)
	const pair = pickPairs(s, 1)[0]
	const pairArea = pair ? areaOf(pair.hi) : null
	const focus = (open?.kind === "scale" ? open.sc.area : open?.kind === "pair" ? pairArea : null) ?? hover

	const row = (sc: Scale) => {
		const on = open?.kind === "scale" && open.sc.name === sc.name
		return <Row key={sc.name} sc={sc} t={t} focus={focus} on={on} onHover={setHover} onPick={(el) => setOpen(on ? null : { kind: "scale", sc, el })} />
	}
	const [feel, story, look] = GROUPS
	const head = "mb-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

	return (
		<div>
			<SectionTitle t={t} />
			{pair && pairArea ? (
				<button
					type="button"
					data-fp-trigger
					aria-haspopup="dialog"
					aria-expanded={open?.kind === "pair"}
					onPointerEnter={(e) => e.pointerType === "mouse" && setHover(pairArea)}
					onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
					onClick={(e) => setOpen(open?.kind === "pair" ? null : { kind: "pair", el: e.currentTarget })}
					className={`-mx-2 mt-3 block cursor-pointer rounded-xl px-2 py-0.5 text-left text-[1.75rem] font-bold leading-tight tracking-tight hover:bg-white/[.04] focus-visible:outline-2 focus-visible:outline-amber-300 sm:text-[2.5rem] ${open?.kind === "pair" ? "bg-white/[.06]" : ""}`}
				>
					<PairText p={pair.p} color={HEX[pairArea]} />
				</button>
			) : (
				<p className="mt-3 text-[1.75rem] font-bold leading-tight tracking-tight text-amber-200 sm:text-[2.5rem]">{tagline(t, media)}.</p>
			)}
			<p className="mt-2 max-w-3xl text-gray-400">{F.summary(t)}</p>

			<div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4 lg:gap-x-10">
				<section className="col-span-2">
					<h3 className={head}>{feel.name}</h3>
					<ul className="grid grid-cols-2 gap-x-5 lg:grid-flow-col lg:grid-rows-3 lg:gap-x-10">{feel.scales.map(row)}</ul>
				</section>
				<section className="max-lg:col-span-2">
					<h3 className={head}>{story.name}</h3>
					<ul className="grid grid-cols-2 items-end gap-x-5 lg:grid-cols-1">{story.scales.map(row)}</ul>
				</section>
				<section className="max-lg:col-span-2">
					<h3 className={head}>{look.name}</h3>
					<ul className="grid grid-cols-2 gap-x-5 lg:grid-cols-1">{look.scales.map(row)}</ul>
				</section>
			</div>
			<div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
				<GoodForLine t={t} />
				<p className="text-xs text-gray-500">Select a reading to see the traits behind it.</p>
			</div>

			{open && (
				<FloatCard
					anchor={open.el}
					onClose={() => setOpen(null)}
					label={open.kind === "scale" ? `${open.sc.name} in detail` : "Where this comes from"}
					color={HEX[open.kind === "scale" ? open.sc.area : (pairArea ?? "Energy")]}
				>
					{open.kind === "scale" ? (
						<ScaleCardBody sc={open.sc} t={t} />
					) : (
						pair && <PairCardBody hi={pair.hi} other={pair.other} s={s} color={HEX[pairArea ?? "Energy"]} />
					)}
				</FloatCard>
			)}
		</div>
	)
}
