// PROTOTYPE - throwaway.
// Signature band: one segment per area, as wide as the area is strong, striped by its traits; words under it, compact sliders below.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useRef, useState } from "react"
import { DriverBars, HEX, MoreLinks, type Pillar, PILLARS, Verdict, tint } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, tagline } from "./strip-parts"
import { AREA_WORD, GoodForLine, type Key, PHONE_WORD, SCALES, type Scale, type Scores, wordAt } from "./versus-parts"

// Small deterministic hash, so a title always gets the same band.
function hash(str: string) {
	let h = 2166136261
	for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
	return (h >>> 0) / 4294967295
}

// The lines of one area, movie-barcode style: every trait (own and related) adds a few thin lines,
// more and brighter the higher it scores, shuffled by title so every band differs.
function stripes(p: Pillar, s: Scores, seed: string) {
	const keys: Key[] = [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p].filter((k) => !(F.PILLAR_KEYS[p] as readonly Key[]).includes(k))]
	const lines: { id: string; key: Key; score: number; w: number; b: number }[] = []
	for (const k of keys) {
		const n = 1 + Math.round(s[k] / 1.6)
		for (let i = 0; i < n; i++) {
			const r = hash(`${seed}:${k}:${i}`)
			lines.push({ id: `${k}${i}`, key: k, score: s[k], w: (0.35 + r * 1.3) * (0.6 + s[k] / 20), b: Math.max(0, Math.min(10, s[k] + (r - 0.5) * 4)) })
		}
	}
	return lines.sort((a, b) => hash(`${seed}${a.id}`) - hash(`${seed}${b.id}`))
}

const shade = (hex: string, b: number) => `color-mix(in srgb, ${hex} ${Math.round(8 + b * 9.2)}%, #0c0a09)`

function MiniSlider({ sc, s }: { sc: Scale; s: Scores }) {
	const v = sc.value(s)
	const word = wordAt(sc, v)
	return (
		<li className="min-w-0">
			<p className="flex items-baseline justify-between gap-2 text-sm">
				<span className="text-gray-400">{sc.name}</span>
				<span className="truncate font-semibold text-white">{word}</span>
			</p>
			<span
				role="img"
				aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
				className="relative mt-1.5 block h-1.5 rounded-full bg-white/8"
			>
				<span className="absolute inset-y-0 left-1/2 w-px bg-white/15" aria-hidden="true" />
				<span
					aria-hidden="true"
					className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/50"
					style={{ left: `calc(6px + ${v} * (100% - 12px))`, background: HEX[sc.area] }}
				/>
			</span>
			<p className="mt-1 flex justify-between text-[11px] text-gray-500" aria-hidden="true">
				<span>{sc.left}</span>
				<span>{sc.right}</span>
			</p>
		</li>
	)
}

export default function Barcode({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const [open, setOpen] = useState<Pillar | null>(null)
	const cells = useRef<Record<string, HTMLButtonElement | null>>({})
	const close = () => {
		const p = open
		setOpen(null)
		if (p) cells.current[p]?.focus()
	}
	return (
		<div onKeyDown={(e) => e.key === "Escape" && close()}>
			<SectionTitle t={t} />
			<p className="mt-2 text-2xl font-semibold tracking-tight text-amber-200">{tagline(t, media)}.</p>
			<p className="mt-1 text-gray-300">{F.summary(t)}</p>

			<div className="mt-5 flex gap-[3px]">
				{PILLARS.map((p, i) => {
					const on = open === p
					const dim = open !== null && !on
					const st = stripes(p, s, t.title)
					return (
						<button
							key={p}
							ref={(el) => {
								cells.current[p] = el
							}}
							type="button"
							aria-expanded={on}
							aria-controls="barcode-panel"
							aria-label={`${p}: ${AREA_WORD[p][tiers[p]].toLowerCase()}`}
							onClick={() => setOpen(on ? null : p)}
							className="group flex min-w-[2.9rem] sm:min-w-[3.4rem] cursor-pointer flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
							style={{ flex: `${tiers[p] + 1.5} 1 0%` }}
						>
							<span
								aria-hidden="true"
								className={`relative flex h-16 w-full overflow-hidden transition-opacity duration-200 sm:h-20 ${i === 0 ? "rounded-l-xl" : ""} ${
									i === PILLARS.length - 1 ? "rounded-r-xl" : ""
								} ${dim ? "opacity-30" : "group-hover:opacity-90"}`}
							>
								{st.map((x) => (
									<span
										key={x.id}
										title={`${getFingerprintMeta(x.key).label}: ${x.score} of 10`}
										className="h-full"
										style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }}
									/>
								))}
								<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.10),transparent_35%,transparent_65%,rgba(0,0,0,.30))]" />
							</span>
							<span className={`mt-2 block h-0.5 w-full rounded-full transition-opacity ${on ? "opacity-100" : "opacity-0"}`} style={{ background: HEX[p] }} />
							<span className={`mt-1.5 block text-xs transition-opacity ${dim ? "text-gray-500" : "text-gray-400"}`}>
								<span aria-hidden="true" className="max-sm:hidden">
									{PILLAR_CONFIG[p].emoji}{" "}
								</span>
								{p}
							</span>
							<span className={`block text-[13px] font-semibold leading-tight sm:text-base ${dim ? "text-gray-400" : "text-white"}`}>
								<span className="sm:hidden">{PHONE_WORD[AREA_WORD[p][tiers[p]]] ?? AREA_WORD[p][tiers[p]]}</span>
								<span className="max-sm:hidden">{AREA_WORD[p][tiers[p]]}</span>
							</span>
						</button>
					)
				})}
			</div>

			{open && (
				<section
					id="barcode-panel"
					aria-label={`${open} in detail`}
					className="relative mt-3 rounded-2xl border border-white/10 p-4 sm:p-5 animate-[bcIn_160ms_ease-out]"
					style={tint(open, 14)}
				>
					<style>{"@keyframes bcIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						<XMarkIcon className="h-5 w-5" aria-hidden="true" />
					</button>
					<div className="grid gap-5 md:grid-cols-[1fr_17rem] md:gap-10 md:pr-10 [&>*]:min-w-0">
						<div className="space-y-4 pr-8">
							<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[open] }}>
								{PILLAR_CONFIG[open].emoji} {open}
							</p>
							<Verdict t={t} p={open} size="lg" />
							<MoreLinks t={t} p={open} />
						</div>
						<DriverBars t={t} p={open} compact />
					</div>
				</section>
			)}

			<ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4 lg:gap-x-10">
				{SCALES.map((sc) => (
					<MiniSlider key={sc.name} sc={sc} s={s} />
				))}
			</ul>
			<GoodForLine t={t} className="mt-5" />
		</div>
	)
}
