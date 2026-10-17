// PROTOTYPE - throwaway.
// Shared bits for versus2, bandversus and barcode2: versus pairs and is/isn't words (copied from Versus.tsx), the band, a floating evidence card.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HEX, MoreLinks, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { AREA_WORD, type Key, PHONE_WORD, type Scale, type Scores, areaOf, wordAt } from "./versus-parts"

// ---------------------------------------------------------------------------
// Versus pairs and is/isn't words (copied from Versus.tsx, which doesn't export them)
// ---------------------------------------------------------------------------

const HUMOR: Key[] = ["situational_comedy", "wit_wordplay", "physical_comedy", "absurdist_humor", "satire_parody", "dark_humor"]
const maxOf = (s: Scores, ks: Key[]) => Math.max(...ks.map((k) => s[k]))
const argMax = (s: Scores, ks: Key[]) => [...ks].sort((a, b) => s[b] - s[a])[0]

interface Pair {
	a: string
	conj: "not" | "but" | "with"
	b: string
	hi: (s: Scores) => Key
	other: (s: Scores) => Key
	ok: (s: Scores) => boolean
	score: (s: Scores) => number
}

const k = (key: Key) => () => key
const not = (a: string, b: string, hi: Key, lo: Key, min: number, max: number): Pair => ({
	a,
	conj: "not",
	b,
	hi: k(hi),
	other: k(lo),
	ok: (s) => s[hi] >= min && s[lo] <= max,
	score: (s) => s[hi] - s[lo],
})
const but = (a: string, b: string, x: Key | Key[], y: Key | Key[], min: number, conj: "but" | "with" = "but"): Pair => {
	const xs = Array.isArray(x) ? x : [x]
	const ys = Array.isArray(y) ? y : [y]
	return {
		a,
		conj,
		b,
		hi: (s) => argMax(s, xs),
		other: (s) => argMax(s, ys),
		ok: (s) => maxOf(s, xs) >= min && maxOf(s, ys) >= min,
		score: (s) => Math.min(maxOf(s, xs), maxOf(s, ys)) - 4.5,
	}
}

const PAIRS: Pair[] = [
	not("Tense", "scary", "tension", "scare", 7, 4),
	not("Exciting", "scary", "adrenaline", "scare", 6, 3),
	not("Thrilling", "gory", "adrenaline", "grotesque", 7, 3),
	not("Violent", "gory", "violence", "grotesque", 7, 3),
	not("Philosophical", "slow", "philosophical", "slow_burn", 7, 3),
	not("Heartwarming", "a tearjerker", "wholesome", "pathos", 7, 4),
	not("Clever", "confusing", "complexity", "ambiguity", 8, 4),
	not("A crime story", "a whodunit", "crime", "mystery", 8, 5),
	not("Strange", "hard to follow", "surrealism", "complexity", 7, 5),
	{ ...but("Feel-good", "fluffy", "hopefulness", ["character_depth", "complexity"], 8), conj: "not" },
	{ ...but("Action-packed", "mindless", "adrenaline", ["philosophical", "complexity"], 8), conj: "not" },
	{ ...but("Family-friendly", "childish", "wholesome", ["character_depth", "wit_wordplay", "complexity"], 7), conj: "not" },
	but("Epic", "personal", "spectacle", "character_depth", 8),
	but("Fast", "layered", "fast_pace", "complexity", 7),
	but("Slow", "gripping", "slow_burn", ["tension", "intrigue"], 7),
	but("Bleak", "darkly funny", "bleakness", "dark_humor", 7),
	but("Funny", "bittersweet", HUMOR, "melancholy", 7),
	but("Quirky", "heartfelt", "eccentricity", "pathos", 7),
	but("Violent", "thoughtful", "violence", "philosophical", 8),
	but("Nostalgic", "fresh", "nostalgia", "novelty", 8),
	but("Dark", "hopeful", "bleakness", "hopefulness", 6),
	but("Stylish", "substance", "visual_stylization", ["character_depth", "philosophical", "narrative_structure"], 9, "with"),
	but("Funny", "heart", HUMOR, ["pathos", "wholesome"], 7, "with"),
]

export interface Line {
	a: string
	conj: "not" | "but" | "with"
	b: string
	hi: Key
	other: Key
}

function pickPairs(s: Scores): Line[] {
	const used = new Set<Key>()
	const out: Line[] = []
	const ranked = PAIRS.filter((p) => p.ok(s)).sort((x, y) => y.score(s) - x.score(s))
	for (const p of ranked) {
		const hi = p.hi(s)
		const other = p.other(s)
		if (used.has(hi) || used.has(other)) continue
		used.add(hi)
		used.add(other)
		out.push({ a: p.a, conj: p.conj, b: p.b, hi, other })
		if (out.length === 3) break
	}
	return out
}

const IS_WORD: Partial<Record<Key, string>> = {
	adrenaline: "thrilling",
	tension: "tense",
	scare: "scary",
	violence: "violent",
	romance: "romantic",
	eroticism: "steamy",
	wholesome: "wholesome",
	wonder: "full of wonder",
	pathos: "moving",
	melancholy: "melancholic",
	uncanny: "eerie",
	catharsis: "cathartic",
	nostalgia: "nostalgic",
	hopefulness: "hopeful",
	bleakness: "bleak",
	slow_burn: "slow-burning",
	fast_pace: "fast",
	intrigue: "gripping",
	complexity: "layered",
	ambiguity: "ambiguous",
	surrealism: "surreal",
	eccentricity: "quirky",
	philosophical: "philosophical",
	spectacle: "spectacular",
	psychedelic: "trippy",
	grotesque: "gory",
	camp_and_irony: "campy",
	wit_wordplay: "witty",
	absurdist_humor: "absurd",
	satire_parody: "satirical",
	dark_humor: "darkly funny",
	situational_comedy: "funny",
	physical_comedy: "slapstick",
	futuristic: "futuristic",
	fantasy: "magical",
	historical: "historical",
	psychological: "psychological",
	visual_stylization: "stylish",
	novelty: "original",
	character_depth: "character-driven",
	world_immersion: "immersive",
	mystery: "mysterious",
	rewatchability: "rewatchable",
}

export interface Word {
	key: Key
	word: string
	expected?: boolean
}

function isWords(s: Scores, hl: string[], skip: Key[]): Word[] {
	const keys = (Object.keys(IS_WORD) as Key[]).filter((x) => s[x] >= 7 && !skip.includes(x))
	return keys
		.sort((a, b) => s[b] + (hl.includes(b) ? 1.5 : 0) - (s[a] + (hl.includes(a) ? 1.5 : 0)))
		.slice(0, 6)
		.map((x) => ({ key: x, word: IS_WORD[x] ?? "" }))
}

const ISNT: { word: string; value: (s: Scores) => number; key: Key }[] = [
	{ word: "scary", key: "scare", value: (s) => s.scare },
	{ word: "gory", key: "grotesque", value: (s) => s.grotesque },
	{ word: "violent", key: "violence", value: (s) => s.violence },
	{ word: "romantic", key: "romance", value: (s) => s.romance },
	{ word: "steamy", key: "eroticism", value: (s) => s.eroticism },
	{ word: "slow", key: "slow_burn", value: (s) => s.slow_burn },
	{ word: "rushed", key: "fast_pace", value: (s) => s.fast_pace },
	{ word: "bleak", key: "bleakness", value: (s) => s.bleakness },
	{ word: "hopeful", key: "hopefulness", value: (s) => s.hopefulness },
	{ word: "a comedy", key: "situational_comedy", value: (s) => maxOf(s, HUMOR) },
	{ word: "silly", key: "physical_comedy", value: (s) => s.physical_comedy },
	{ word: "a tearjerker", key: "pathos", value: (s) => s.pathos },
	{ word: "sad", key: "melancholy", value: (s) => s.melancholy },
	{ word: "complicated", key: "complexity", value: (s) => s.complexity },
	{ word: "a mystery", key: "mystery", value: (s) => s.mystery },
	{ word: "a spectacle", key: "spectacle", value: (s) => s.spectacle },
]

const GENRE_EXPECTS: Record<string, Key[]> = {
	Action: ["grotesque", "violence", "fast_pace", "spectacle"],
	Adventure: ["spectacle", "fast_pace"],
	"Action & Adventure": ["violence", "spectacle"],
	"Science Fiction": ["slow_burn", "bleakness", "complexity"],
	"Sci-Fi & Fantasy": ["slow_burn", "complexity"],
	Horror: ["scare", "grotesque"],
	Thriller: ["scare", "violence"],
	Comedy: ["situational_comedy", "physical_comedy"],
	Drama: ["pathos", "slow_burn", "melancholy", "bleakness"],
	Crime: ["violence", "bleakness", "mystery"],
	Mystery: ["mystery", "scare"],
	Romance: ["romance", "eroticism"],
	Animation: ["physical_comedy", "situational_comedy"],
	Family: ["physical_comedy", "pathos"],
	War: ["violence", "bleakness", "grotesque"],
	History: ["slow_burn"],
	Fantasy: ["spectacle", "scare"],
}

function isntWords(t: F.TitleInput, skip: Key[], n: number): Word[] {
	const s = t.fingerprint.scores
	const expected = new Set(t.genres.flatMap((g) => GENRE_EXPECTS[g] ?? []))
	const kids = t.fingerprint.socialSuitability.some((x) => x.name === "Kids")
	const obvious: Key[] = kids ? ["eroticism", "grotesque", "violence"] : []
	const cand = ISNT.filter((x) => !skip.includes(x.key) && !obvious.includes(x.key) && x.value(s) <= (expected.has(x.key) ? 4 : 3))
	return cand
		.sort((a, b) => Number(expected.has(b.key)) - Number(expected.has(a.key)) || a.value(s) - b.value(s))
		.slice(0, n)
		.map((x) => ({ key: x.key, word: x.word, expected: expected.has(x.key) }))
}

export const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

// The three contrast lines, then what it also is and what it isn't (no trait repeated).
export function versusData(t: F.TitleInput, media: VariantProps["media"]) {
	const s = t.fingerprint.scores
	const hl = (media.fingerprint as { highlightKeys?: string[] } | null)?.highlightKeys ?? []
	let lines = pickPairs(s)
	const used = lines.flatMap((x) => [x.hi, x.other])
	const said = lines.map((l) => `${l.a} ${l.b}`.toLowerCase()).join(" ")
	const is = isWords(s, hl, used)
		.filter((w) => !said.includes(w.word))
		.slice(0, 4)
	const isnt = isntWords(t, used, 6)
		.filter((w) => !said.includes(w.word))
		.slice(0, 3)
	if (lines.length === 0 && is[0] && isnt[0]) lines = [{ a: cap(is[0].word), conj: "not", b: isnt[0].word, hi: is[0].key, other: isnt[0].key }]
	return { lines, is, isnt }
}

// "a, b, or c" / "a, b, and c", with each comma kept on the line of its word.
export function joinWords(xs: React.ReactElement[], last: "and" | "or"): ReactNode[] {
	const n = xs.length
	const out: ReactNode[] = []
	xs.forEach((x, i) => {
		out.push(
			<span key={`w${x.key}`} className="whitespace-nowrap">
				{x}
				{n > 2 && i < n - 1 ? "," : ""}
			</span>,
		)
		if (i < n - 1) out.push(i === n - 2 ? ` ${last} ` : " ")
	})
	return out
}

// ---------------------------------------------------------------------------
// Floating evidence card: anchored under (or above) its trigger on wide screens, a bottom sheet on phones.
// Never in the page flow, so opening it moves nothing.
// ---------------------------------------------------------------------------

const KEYFRAMES =
	"@keyframes v2pop{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}@keyframes v2sheet{from{transform:translateY(100%)}to{transform:none}}@keyframes v2fade{from{opacity:0}to{opacity:1}}"

const refocus = (a: HTMLElement | null) => (a?.closest("button") ?? a)?.focus({ preventScroll: true })

export function Popover({
	anchor,
	onClose,
	label,
	color,
	width = 340,
	side = false,
	children,
}: {
	anchor: HTMLElement | null
	onClose: () => void
	label: string
	color: string
	width?: number
	// Prefer the free space to the right of the anchor (falls back to below/above).
	side?: boolean
	children: ReactNode
}) {
	const card = useRef<HTMLDivElement>(null)
	const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
	const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.innerWidth < 640)

	useLayoutEffect(() => {
		const place = () => {
			setPhone(document.documentElement.clientWidth < 640)
			if (!anchor || !card.current) return
			const r = anchor.getBoundingClientRect()
			const w = card.current.offsetWidth
			const h = card.current.offsetHeight
			const vw = Math.min(document.documentElement.clientWidth, document.body.clientWidth)
			if (side && r.right + 16 + w <= vw - 12) {
				const top = Math.min(Math.max(12, r.top + r.height / 2 - 40), window.innerHeight - h - 12)
				setPos({ left: r.right + 16 + window.scrollX, top: top + window.scrollY, above: false })
				return
			}
			const left = Math.min(Math.max(12, r.left), vw - w - 12)
			const below = r.bottom + 10 + h <= window.innerHeight - 12 || r.top - 10 - h < 12
			setPos({ left: left + window.scrollX, top: (below ? r.bottom + 10 : r.top - 10 - h) + window.scrollY, above: !below })
		}
		place()
		window.addEventListener("resize", place)
		return () => window.removeEventListener("resize", place)
	}, [anchor, side])

	// Focus once placed (a hidden card can't take focus).
	const placed = pos !== null
	useEffect(() => {
		if (placed) card.current?.focus({ preventScroll: true })
	}, [anchor, placed])

	useEffect(() => {
		const down = (e: PointerEvent) => {
			const n = e.target as Node
			if (card.current?.contains(n) || (anchor?.closest("button") ?? anchor)?.contains(n)) return
			onClose()
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			onClose()
			refocus(anchor)
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [anchor, onClose])

	const body = (
		<>
			<style>{KEYFRAMES}</style>
			<button
				type="button"
				onClick={() => {
					onClose()
					refocus(anchor)
				}}
				aria-label="Close"
				className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				<XMarkIcon className="h-5 w-5" aria-hidden="true" />
			</button>
			{children}
		</>
	)
	const surface = {
		background: `linear-gradient(160deg, color-mix(in srgb, ${color} 16%, #1c1917) 0%, #141210 60%)`,
		boxShadow: `0 24px 60px -18px rgba(0,0,0,.85), 0 0 0 1px color-mix(in srgb, ${color} 28%, rgba(255,255,255,.08)), inset 0 1px 0 rgba(255,255,255,.06)`,
	}

	if (phone)
		return createPortal(
			<div className="fixed inset-0 z-[70]">
				<div className="absolute inset-0 bg-black/55 motion-safe:animate-[v2fade_180ms_ease-out]" aria-hidden="true" />
				<div
					ref={card}
					role="dialog"
					aria-label={label}
					tabIndex={-1}
					className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-gray-100 outline-none motion-safe:animate-[v2sheet_240ms_cubic-bezier(.2,.8,.2,1)]"
					style={surface}
				>
					<span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
					{body}
				</div>
			</div>,
			document.body,
		)

	return createPortal(
		<div
			ref={card}
			role="dialog"
			aria-label={label}
			tabIndex={-1}
			className="absolute z-[70] rounded-2xl p-5 pr-12 text-gray-100 outline-none motion-safe:animate-[v2pop_160ms_ease-out]"
			style={{
				...surface,
				width,
				maxWidth: "calc(100vw - 24px)",
				top: pos?.top ?? 0,
				left: pos?.left ?? 0,
				visibility: pos ? "visible" : "hidden",
				transformOrigin: pos?.above ? "bottom left" : "top left",
			}}
		>
			{body}
		</div>,
		document.body,
	)
}

// One trait as a labeled meter, in plain words first.
const LEVEL = (v: number) => (v >= 9 ? "Very strong" : v >= 7 ? "Strong" : v >= 5 ? "Some" : v >= 3 ? "A little" : v >= 1 ? "Barely" : "None")

export function TraitMeter({ k, s, dim = false }: { k: Key; s: Scores; dim?: boolean }) {
	const meta = getFingerprintMeta(k)
	const color = dim ? "#78716c" : HEX[areaOf(k)]
	return (
		<div>
			<p className="flex items-baseline justify-between gap-3 text-sm">
				<span className="font-semibold text-white">{meta.label}</span>
				<span className="shrink-0 text-xs text-gray-400">
					{LEVEL(s[k])} <span className="tabular-nums text-gray-500">· {s[k]}/10</span>
				</span>
			</p>
			<span className="mt-1.5 flex gap-[3px]" aria-hidden="true">
				{Array.from({ length: 10 }, (_, i) => (
					<span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < s[k] ? color : "rgba(255,255,255,.08)" }} />
				))}
			</span>
			{meta.description && <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{meta.description}</p>}
		</div>
	)
}

// Evidence for a contrast line: the trait that is there, then the one that is (or isn't).
export function LineEvidence({ line, s }: { line: Line; s: Scores }) {
	const lowOther = line.conj === "not"
	return (
		<div className="space-y-4">
			<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Why we say so</p>
			<TraitMeter k={line.hi} s={s} />
			<TraitMeter k={line.other} s={s} dim={lowOther} />
		</div>
	)
}

export function WordEvidence({ w, s, isnt, t }: { w: Word; s: Scores; isnt: boolean; t: F.TitleInput }) {
	const genre = t.genres[0]
	return (
		<div className="space-y-3">
			<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
				{isnt ? (w.expected && genre ? `Unusual for ${genre.toLowerCase()}` : "Barely there") : "Stands out"}
			</p>
			<TraitMeter k={w.key} s={s} dim={isnt} />
		</div>
	)
}

// ---------------------------------------------------------------------------
// It is / it isn't as two compact typographic lines
// ---------------------------------------------------------------------------

export type Pick = { kind: "line"; i: number } | { kind: "is"; i: number } | { kind: "isnt"; i: number } | { kind: "area"; p: Pillar }
export const samePick = (a: Pick | null, b: Pick) => !!a && a.kind === b.kind && ("p" in a ? a.p === (b as { p: Pillar }).p : a.i === (b as { i: number }).i)

const wordBtn =
	"cursor-pointer rounded-md decoration-2 underline-offset-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

export function IsIsntRow({
	is,
	isnt,
	pick,
	onPick,
	refs,
	textStyle,
}: {
	is: Word[]
	isnt: Word[]
	pick: Pick | null
	onPick: (p: Pick, el: HTMLElement) => void
	refs: React.MutableRefObject<Record<string, HTMLElement | null>>
	textStyle?: (w: Word) => React.CSSProperties
}) {
	return (
		<div className="space-y-1">
			{is.length > 0 && (
				<p className="text-[1.375rem] font-bold leading-snug tracking-tight text-gray-300 sm:text-[2rem]">
					<span className="sr-only">It is </span>
					{joinWords(
						is.map((w, i) => {
							const on = samePick(pick, { kind: "is", i })
							return (
								<button
									key={w.key}
									type="button"
									aria-expanded={on}
									ref={(el) => {
										refs.current[`is${i}`] = el
									}}
									onClick={(e) => onPick({ kind: "is", i }, e.currentTarget)}
									className={`${wordBtn} hover:underline ${on ? "underline" : ""}`}
									style={{ color: HEX[areaOf(w.key)], textDecorationColor: "currentColor", ...textStyle?.(w) }}
								>
									{i === 0 ? cap(w.word) : w.word}
								</button>
							)
						}),
						"and",
					)}
					<span className="text-white">.</span>
				</p>
			)}
			{isnt.length > 0 && (
				<p className="text-lg font-semibold leading-snug tracking-tight text-gray-500 sm:text-2xl">
					Not{" "}
					{joinWords(
						isnt.map((w, i) => {
							const on = samePick(pick, { kind: "isnt", i })
							return (
								<button
									key={w.key}
									type="button"
									aria-expanded={on}
									ref={(el) => {
										refs.current[`isnt${i}`] = el
									}}
									onClick={(e) => onPick({ kind: "isnt", i }, e.currentTarget)}
									className={`${wordBtn} decoration-gray-500 hover:text-gray-300 hover:underline ${on ? "text-gray-300 underline" : ""}`}
								>
									{w.word}
								</button>
							)
						}),
						"or",
					)}
					.
				</p>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

function hash(str: string) {
	let h = 2166136261
	for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
	return (h >>> 0) / 4294967295
}

export interface Stripe {
	id: string
	key: Key
	score: number
	w: number
	b: number
}

// Every trait of an area is a cluster: one bar as bright and wide as the score, then a few fine lines
// that fade out, like the afterglow of a frame. Clusters run in a per-title shuffle, so bands differ.
export function stripes(p: Pillar, s: Scores, seed: string): Stripe[] {
	const own = F.PILLAR_KEYS[p] as readonly Key[]
	const keys: Key[] = [...own, ...F.RELATED_KEYS[p].filter((k) => !own.includes(k))]
	const order = [...keys].sort((a, b) => hash(`${seed}${a}`) - hash(`${seed}${b}`))
	const out: Stripe[] = []
	for (const k of order) {
		const v = s[k]
		const r = hash(`${seed}:${k}`)
		out.push({ id: `${k}m`, key: k, score: v, w: 0.6 + v * 0.32 + r * 0.6, b: v })
		const fine = Math.round(v / 3.5)
		for (let i = 0; i < fine; i++) {
			const q = hash(`${seed}:${k}:${i}`)
			out.push({ id: `${k}${i}`, key: k, score: v, w: 0.18 + q * 0.35, b: Math.max(0, v - 2.5 - i * 1.5 - q * 2) })
			out.push({ id: `${k}${i}g`, key: k, score: v, w: 0.08 + q * 0.12, b: 0 })
		}
	}
	return out
}

export const shade = (hex: string, b: number) => `color-mix(in srgb, ${hex} ${Math.round(10 + b * 9)}%, #0c0a09)`

// The band of one area as a hard-stop gradient, for painting words with it.
export function bandGradient(p: Pillar, s: Scores, seed: string, floor = 55) {
	const st = stripes(p, s, seed)
	const total = st.reduce((a, x) => a + x.w, 0)
	let at = 0
	const stops = st.map((x) => {
		const from = (at / total) * 100
		at += x.w
		const pct = Math.round(floor + (x.b / 10) * (100 - floor))
		return `color-mix(in srgb, ${HEX[p]} ${pct}%, #f5f5f4) ${from.toFixed(2)}% ${((at / total) * 100).toFixed(2)}%`
	})
	return `linear-gradient(90deg, ${stops.join(", ")})`
}

const BAND_KEYFRAMES = "@keyframes v2grow{from{opacity:0;transform:scaleY(.15)}to{opacity:1;transform:none}}"

// The signature band: one segment per area, as wide as the area is strong. Purely visual plus a button per segment.
export function Band({
	t,
	focus,
	onPick,
	refs,
	className = "h-20 sm:h-24",
	widthOf = (tier: number) => tier + 1,
}: {
	t: F.TitleInput
	focus: Pillar | null
	onPick: (p: Pillar, el: HTMLElement) => void
	refs: React.MutableRefObject<Record<string, HTMLElement | null>>
	className?: string
	widthOf?: (tier: number) => number
}) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	return (
		<div className="relative">
			<style>{BAND_KEYFRAMES}</style>
			<div className={`flex gap-[3px] ${className}`}>
				{PILLARS.map((p, i) => {
					const on = focus === p
					const dim = focus !== null && !on
					return (
						<button
							key={p}
							ref={(el) => {
								refs.current[p] = el
							}}
							type="button"
							data-band={p}
							aria-expanded={on}
							aria-label={`${p}: ${AREA_WORD[p][tiers[p]].toLowerCase()}. Show what's behind it`}
							onClick={(e) => onPick(p, e.currentTarget)}
							className={`group relative h-full min-w-0 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
								i === 0 ? "rounded-l-2xl" : ""
							} ${i === PILLARS.length - 1 ? "rounded-r-2xl" : ""}`}
							style={{ flex: `${widthOf(tiers[p])} 1 0%` }}
						>
							<span
								aria-hidden="true"
								className={`absolute inset-0 flex origin-bottom overflow-hidden transition-opacity duration-300 motion-safe:animate-[v2grow_700ms_cubic-bezier(.2,.8,.2,1)_both] ${
									i === 0 ? "rounded-l-2xl" : ""
								} ${i === PILLARS.length - 1 ? "rounded-r-2xl" : ""} ${dim ? "opacity-25" : "group-hover:opacity-90"}`}
								style={{ animationDelay: `${i * 70}ms`, boxShadow: `0 14px 34px -16px ${HEX[p]}` }}
							>
								{stripes(p, s, t.title).map((x) => (
									<span key={x.id} className="h-full" style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
								))}
								{/* Sheen: light from above, a soft floor, and a fine top edge. */}
								<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.16)_0%,rgba(255,255,255,.04)_28%,transparent_50%,rgba(0,0,0,.38)_100%)]" />
								<span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
							</span>
							<span
								aria-hidden="true"
								className={`absolute inset-x-0 -bottom-2 h-[3px] rounded-full transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
								style={{ background: HEX[p] }}
							/>
						</button>
					)
				})}
			</div>
		</div>
	)
}

// What's behind an area: its word, the verdict sentence, the traits that drive it.
export function AreaEvidence({ t, p, links = false }: { t: F.TitleInput; p: Pillar; links?: boolean }) {
	const b = F.pillarBrief(t, p)
	return (
		<div>
			<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: HEX[p] }}>
				<span aria-hidden="true">{PILLAR_CONFIG[p].emoji} </span>
				{p} · {AREA_WORD[p][t.fingerprint.pillars[p]]}
			</p>
			<p className="mt-2 text-base font-semibold leading-snug text-white">{b.verdict}</p>
			{b.note && <p className="mt-1 text-sm leading-relaxed text-gray-400">{b.note}</p>}
			<ul className="mt-4 space-y-2">
				{b.drivers.map((d) => (
					<li key={d.key} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-xs">
						<span className="truncate text-gray-300">{getFingerprintMeta(d.key).label}</span>
						<span className="tabular-nums text-gray-500">{d.score}/10</span>
						<span className="col-span-2 mt-1 h-1.5 rounded-full bg-white/8">
							<span className="block h-1.5 rounded-full" style={{ width: `${d.score * 10}%`, background: HEX[p] }} />
						</span>
					</li>
				))}
			</ul>
			{links && (
				<div className="mt-4 [&_a]:py-1 [&_a]:text-xs">
					<MoreLinks t={t} p={p} />
				</div>
			)}
		</div>
	)
}

export const areaWordFor = (p: Pillar, tier: number, phone: boolean) => (phone ? (PHONE_WORD[AREA_WORD[p][tier]] ?? AREA_WORD[p][tier]) : AREA_WORD[p][tier])

// Compact two-ended slider (copied from Barcode.tsx), static.
export function MiniSlider({ sc, s }: { sc: Scale; s: Scores }) {
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
				className="relative mt-2 block h-1 rounded-full"
				style={{ background: `linear-gradient(90deg, rgba(255,255,255,.06), color-mix(in srgb, ${HEX[sc.area]} 30%, rgba(255,255,255,.06)) ${v * 100}%, rgba(255,255,255,.06) ${v * 100}%)` }}
			>
				<span className="absolute inset-y-[-3px] left-1/2 w-px bg-white/15" aria-hidden="true" />
				<span
					aria-hidden="true"
					className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
					style={{ left: `calc(7px + ${v} * (100% - 14px))`, background: HEX[sc.area], boxShadow: `0 0 12px ${HEX[sc.area]}` }}
				/>
			</span>
			<p className="mt-1.5 flex justify-between text-[11px] text-gray-500" aria-hidden="true">
				<span>{sc.left}</span>
				<span>{sc.right}</span>
			</p>
		</li>
	)
}

// ---------------------------------------------------------------------------
// The big contrast lines
// ---------------------------------------------------------------------------

export function VersusLines({
	lines,
	pick,
	onPick,
	refs,
	paint,
	dimOthers = false,
}: {
	lines: Line[]
	pick: Pick | null
	onPick: (p: Pick, el: HTMLElement) => void
	refs: React.MutableRefObject<Record<string, HTMLElement | null>>
	// Optional fill for the first word (e.g. the band's stripes).
	paint?: (l: Line) => React.CSSProperties
	// Dim lines whose area isn't the focused one.
	dimOthers?: Pillar | null | false
}) {
	return (
		<ul className="space-y-0.5">
			{lines.map((l, i) => {
				const on = samePick(pick, { kind: "line", i })
				const color = HEX[areaOf(l.hi)]
				const dim = dimOthers ? areaOf(l.hi) !== dimOthers : false
				const words = l.b.split(" ")
				return (
					<li key={l.a + l.b} className={`transition-opacity duration-200 ${dim ? "opacity-35" : ""}`}>
						<button
							type="button"
							aria-expanded={on}
							aria-haspopup="dialog"
							ref={(el) => {
								refs.current[`line${i}`] = el
							}}
							onClick={(e) => onPick({ kind: "line", i }, e.currentTarget.querySelector<HTMLElement>("[data-plus]") ?? e.currentTarget)}
							className="group -mx-2 cursor-pointer rounded-xl px-2 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							<span className="text-[2rem] font-bold leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.12]">
								<span style={paint ? { ...paint(l), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color }}>{l.a},</span>{" "}
								<span className={`${l.conj === "not" ? "text-gray-500" : "text-white"} ${words.length <= 2 ? "whitespace-nowrap" : ""}`}>
									{l.conj} {words.slice(0, -1).join(" ")}{" "}
									<span className="whitespace-nowrap">
										{words.at(-1)}.
										<span
											aria-hidden="true"
											data-plus=""
											className={`ml-3 inline-flex h-6 w-6 translate-y-[-0.35em] items-center justify-center rounded-full border align-middle text-sm font-normal transition-[transform,opacity] duration-200 ${
												on ? "rotate-45 border-white/50 text-white" : "border-white/15 text-gray-400 group-hover:border-white/40 group-hover:text-white"
											}`}
										>
											+
										</span>
									</span>
								</span>
							</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}

// One shared state machine for "which thing is open" and the element it hangs from.
export function usePick() {
	const [pick, setPick] = useState<Pick | null>(null)
	const [anchor, setAnchor] = useState<HTMLElement | null>(null)
	const refs = useRef<Record<string, HTMLElement | null>>({})
	const toggle = (p: Pick, el: HTMLElement) => {
		if (samePick(pick, p)) {
			setPick(null)
			setAnchor(null)
		} else {
			setPick(p)
			setAnchor(el)
		}
	}
	const close = useCallback(() => {
		setPick(null)
		setAnchor(null)
	}, [])
	return { pick, anchor, refs, toggle, close }
}

// Area words for the band. Wide screens: under their segments, same widths as the band. Phones: their own
// legend grid, so the band's widths stay honest even for a near-empty area.
export function BandLegend({
	t,
	focus,
	onPick,
	widthOf = (tier: number) => tier + 1,
	size = "lg",
}: {
	t: F.TitleInput
	focus: Pillar | null
	onPick: (p: Pillar, el: HTMLElement) => void
	widthOf?: (tier: number) => number
	size?: "sm" | "lg"
}) {
	const tiers = t.fingerprint.pillars
	const word = (p: Pillar) => AREA_WORD[p][tiers[p]]
	return (
		<>
			<div className="mt-3 hidden gap-[3px] sm:flex" aria-hidden="true">
				{PILLARS.map((p) => {
					const dim = focus !== null && focus !== p
					return (
						<div
							key={p}
							className={`min-w-0 cursor-pointer pr-2 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}
							style={{ flex: `${widthOf(tiers[p])} 1 0%` }}
							onClick={(e) => onPick(p, e.currentTarget.ownerDocument.querySelector<HTMLElement>(`[data-band="${p}"]`) ?? e.currentTarget)}
						>
							<p className="truncate text-xs text-gray-400">
								{size === "lg" && <span>{PILLAR_CONFIG[p].emoji} </span>}
								{p}
							</p>
							<p className={`truncate font-semibold leading-tight text-white ${size === "lg" ? "text-base" : "text-sm"}`}>{word(p)}</p>
						</div>
					)
				})}
			</div>
			<ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 sm:hidden">
				{PILLARS.map((p) => {
					const dim = focus !== null && focus !== p
					return (
						<li key={p} className={`flex min-w-0 items-start gap-2 transition-opacity duration-200 ${dim ? "opacity-40" : ""}`}>
							<span className="mt-1 h-6 w-1 shrink-0 rounded-full" style={{ background: HEX[p] }} aria-hidden="true" />
							<span className="min-w-0 leading-tight">
								<span className="block truncate text-[11px] text-gray-400">{p}</span>
								<span className="block truncate text-sm font-semibold text-white">{areaWordFor(p, tiers[p], true)}</span>
							</span>
						</li>
					)
				})}
			</ul>
		</>
	)
}
