// PROTOTYPE - throwaway.
// The title as a recipe: ingredients in parts with a layered glass, taste notes, when to serve it, and mood pages it pairs with.
import { Fragment, useState } from "react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, goodFor } from "./strip-parts"
import { type Key, MoodLink, NOUN, SCALES, type Scores, areaColor, areaOf, wordAt } from "./versus-parts"

// Near-duplicates: only the strongest of each group makes the list.
const GROUPS: Key[][] = [
	["futuristic", "technology_and_humanity"],
	["pathos", "melancholy"],
	["wholesome", "hopefulness"],
	["complexity", "intrigue"],
	["adrenaline", "fast_pace"],
	["visual_stylization", "spectacle"],
	["crime", "violence"],
]
// Feelings and themes make better ingredients than structure.
const STRUCTURAL: Key[] = ["character_depth", "complexity", "novelty", "visual_stylization", "slow_burn", "fast_pace", "ambiguity"]

interface Ingredient {
	key: Key
	noun: string
	parts: number
	measure: string
	fill: string
}

const MEASURE = ["", "1 part", "2 parts", "3 parts"]

function ingredients(s: Scores, hl: string[]): Ingredient[] {
	const rank = (k: Key) => s[k] + (hl.includes(k) ? 1 : 0) - (STRUCTURAL.includes(k) ? 0.6 : 0)
	const keys = (Object.keys(NOUN) as Key[]).filter((k) => s[k] >= 6).sort((a, b) => rank(b) - rank(a))
	const picked: Key[] = []
	for (const k of keys) {
		const g = GROUPS.find((x) => x.includes(k))
		if (g && picked.some((p) => g.includes(p))) continue
		picked.push(k)
		if (picked.length === 4) break
	}
	// Parts follow rank, with ties in score kept equal.
	const plan = [3, 2, 2, 1]
	const main = picked.map((k, i) => {
		const parts = i > 0 && s[k] === s[picked[i - 1]] ? Math.min(plan[i - 1], plan[i] + 1) : plan[i]
		return { key: k, noun: NOUN[k] ?? k, parts, measure: MEASURE[parts], fill: "" }
	})
	// A dash: the most surprising mid-level feeling, the thing you'd not guess from the main list.
	const dashKey = (["romance", "dark_humor", "wit_wordplay", "melancholy", "wonder", "nostalgia", "uncanny", "absurdist_humor", "physical_comedy", "hopefulness", "pathos", "scare"] as Key[]).find(
		(k) => s[k] >= 5 && s[k] <= 8 && !picked.includes(k) && !GROUPS.some((g) => g.includes(k) && g.some((x) => picked.includes(x))),
	)
	if (dashKey) main.push({ key: dashKey, noun: NOUN[dashKey] ?? dashKey, parts: 0.5, measure: "a dash of", fill: "" })
	// Two ingredients from one area: shade the second darker, the third lighter, so the layers stay apart.
	const seen: Record<string, number> = {}
	for (const x of main) {
		const c = areaColor(x.key)
		const n = (seen[c] = (seen[c] ?? 0) + 1)
		x.fill = n === 1 ? c : n === 2 ? `color-mix(in srgb, ${c} 62%, black)` : `color-mix(in srgb, ${c} 70%, white)`
	}
	return main
}

const CRAFT_NOUN: Partial<Record<Key, string>> = {
	cinematography: "cinematography",
	direction: "direction",
	acting: "performances",
	music_composition: "score",
	dialogue_quality: "dialogue",
	editing: "editing",
	world_immersion: "world-building",
}

const TASTE = ["Bitter", "Dark", "Bittersweet", "Bright", "Sweet"]
const STRENGTH = ["Mild", "Light", "Medium", "Strong", "Potent"]
const BODY = ["Light", "Light", "Medium", "Full", "Full"]

function Glass({ items, hot }: { items: Ingredient[]; hot: Key | null }) {
	const total = items.reduce((n, x) => n + x.parts, 0)
	// Glass interior: y 18 to 150, slightly tapering.
	const top = 22
	const bottom = 150
	const h = bottom - top
	let y = bottom
	const layers = items.map((x) => {
		const lh = (x.parts / total) * h
		y -= lh
		return { ...x, y, lh }
	})
	return (
		<svg viewBox="0 0 120 170" className="h-full w-full" role="img" aria-label={`Glass layered with ${items.map((x) => x.noun).join(", ")}`}>
			<defs>
				<clipPath id="rc-glass">
					<path d="M14 18 L106 18 L96 150 Q95 156 89 156 L31 156 Q25 156 24 150 Z" />
				</clipPath>
				<linearGradient id="rc-shine" x1="0" x2="1">
					<stop offset="0" stopColor="white" stopOpacity="0.16" />
					<stop offset="0.25" stopColor="white" stopOpacity="0" />
					<stop offset="0.8" stopColor="white" stopOpacity="0" />
					<stop offset="1" stopColor="white" stopOpacity="0.08" />
				</linearGradient>
			</defs>
			<g clipPath="url(#rc-glass)">
				<rect x="0" y="0" width="120" height="170" fill="rgba(255,255,255,.03)" />
				{layers.map((l) => (
					<rect
						key={l.key}
						x="0"
						y={l.y}
						width="120"
						height={l.lh + 0.5}
						fill={l.fill}
						style={{ transition: "opacity 200ms" }}
						opacity={hot && hot !== l.key ? 0.25 : 0.9}
					/>
				))}
				{layers.slice(0, -1).map((l) => (
					<rect key={`${l.key}-line`} x="0" y={l.y - 0.5} width="120" height="1" fill="#0c0a09" opacity="0.55" />
				))}
				{/* Meniscus */}
				<ellipse cx="60" cy={top} rx="46" ry="3" fill="white" opacity="0.18" />
				<rect x="0" y="0" width="120" height="170" fill="url(#rc-shine)" />
			</g>
			<path d="M14 18 L106 18 L96 150 Q95 156 89 156 L31 156 Q25 156 24 150 Z" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
			<path d="M24 160 L96 160" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" />
			{/* Garnish: a citrus wheel on the rim */}
			<g transform="translate(96 16)">
				<circle r="11" fill="#fbbf24" opacity="0.9" />
				<circle r="8.5" fill="#fde68a" />
				{[0, 60, 120].map((a) => (
					<line key={a} x1="-8" y1="0" x2="8" y2="0" stroke="#fbbf24" strokeWidth="1" transform={`rotate(${a})`} />
				))}
			</g>
		</svg>
	)
}

export default function Recipe({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const hl = (media.fingerprint as { highlightKeys?: string[] } | null)?.highlightKeys ?? []
	const [open, setOpen] = useState<Key | null>(null)
	const [hot, setHot] = useState<Key | null>(null)
	const items = ingredients(s, hl)
	const garnish = (Object.keys(CRAFT_NOUN) as Key[]).filter((k) => s[k] >= 9).sort((a, b) => s[b] - s[a])[0]
	const tone = SCALES[1]
	const attention = SCALES[3]
	const toneIdx = tone.words.indexOf(wordAt(tone, tone.value(s)))
	const bodyIdx = attention.words.indexOf(wordAt(attention, attention.value(s)))
	const serve = goodFor(t, 3).shown.map((x) => x.toLowerCase())
	// Mood pages built on the ingredients first, then any other page the title is on.
	const own = F.moodsForKeys(t, items.map((x) => x.key))
	const moods = [...own, ...F.matchingMoods(t).filter((m) => !own.some((o) => o.url === m.url))].slice(0, 3)

	const notes = [
		{ label: "Taste", value: TASTE[toneIdx], hint: `Tone: ${wordAt(tone, tone.value(s)).toLowerCase()}` },
		{ label: "Strength", value: STRENGTH[t.fingerprint.pillars.Energy], hint: "Energy" },
		{ label: "Body", value: BODY[bodyIdx], hint: `Attention: ${wordAt(attention, attention.value(s)).toLowerCase()}` },
	]

	return (
		<div onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
			<SectionTitle t={t} />
			<div className="mt-5 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-8 lg:grid-cols-[9rem_minmax(0,28rem)_minmax(0,24rem)] lg:gap-x-14">
				<div className="h-32 self-start sm:h-48" onMouseLeave={() => setHot(null)}>
					<Glass items={items} hot={hot ?? open} />
				</div>

				<section aria-labelledby="rc-ing">
					<h3 id="rc-ing" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Ingredients
					</h3>
					<ul className="mt-2 space-y-0.5">
						{items.map((x) => {
							const on = open === x.key
							const meta = getFingerprintMeta(x.key)
							return (
								<li key={x.key}>
									<button
										type="button"
										aria-expanded={on}
										onClick={() => setOpen(on ? null : x.key)}
										onMouseEnter={() => setHot(x.key)}
										onMouseLeave={() => setHot(null)}
										className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-baseline gap-2.5 rounded-lg px-2 py-0.5 text-left hover:bg-white/4 focus-visible:outline-2 focus-visible:outline-amber-300"
									>
										<span className="h-3 w-3 shrink-0 translate-y-[1px] rounded-sm" style={{ background: x.fill }} aria-hidden="true" />
										<span className="text-xl leading-snug sm:text-2xl">
											<span className="text-gray-400">{x.measure}</span>{" "}
											<span className="font-semibold text-white">{x.noun}</span>
										</span>
									</button>
									{on && (
										<p className="mb-1 ml-[1.375rem] text-sm text-gray-400 animate-[rcIn_160ms_ease-out]">
											<style>{"@keyframes rcIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}"}</style>
											{meta.label}: {meta.description.replace(/\.$/, "").toLowerCase()}. <span className="text-gray-300">{s[x.key]} of 10</span>
											<span className="text-gray-500"> · {areaOf(x.key)}</span>
										</p>
									)}
								</li>
							)
						})}
					</ul>
					{garnish && (
						<p className="mt-2 text-sm text-gray-300">
							<span className="text-gray-400">Garnish:</span> standout {CRAFT_NOUN[garnish]}
						</p>
					)}
				</section>

				<div className="col-span-2 grid content-start gap-4 lg:col-span-1">
					<dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8">
						{notes.map((n) => (
							<div key={n.label} className="bg-stone-950/90 px-3 py-2" title={n.hint}>
								<dt className="text-xs text-gray-400">{n.label}</dt>
								<dd className="font-semibold text-white">{n.value}</dd>
							</div>
						))}
					</dl>
					{serve.length > 0 && (
						<p className="text-sm text-gray-300">
							<span className="font-semibold text-emerald-200">Serve</span> {serve.join(", ")}
						</p>
					)}
					{moods.length > 0 && (
						<p className="text-sm text-gray-300">
							<span className="font-semibold text-amber-200">Pairs with</span>{" "}
							{moods.map((m, i) => (
								<Fragment key={m.url}>
									{i > 0 && ", "}
									<MoodLink url={m.url} label={m.label} t={t} />
								</Fragment>
							))}
						</p>
					)}
				</div>
			</div>
		</div>
	)
}
