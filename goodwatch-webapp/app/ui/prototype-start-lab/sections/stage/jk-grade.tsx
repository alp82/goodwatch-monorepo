// PROTOTYPE (start page lab, round 11): stage j and k's room grade: the room takes on the mood of what's on show (a
// mood chip, a More moods choice, or a search's reading), as stacked color layers over the scene that crossfade.
import { useEffect, useRef, useState } from "react"
import { MOODS } from "~/domain/moods"
import { moodHue } from "./ab-shared"
import { vocabOf } from "./hi-vocab"
import type { JkFlow } from "./jk-shared"

/**
 * One full-size layer over the room: a color and how it blends, at an opacity. `mix-blend-mode` does the grading:
 * `soft-light` tints and warms without flattening, `screen` lifts the light, `multiply` darkens and cools,
 * `saturation` with a gray drains color, `color` gives a cast, `overlay` tints and adds contrast.
 */
type Layer = { bg: string; blend: "soft-light" | "screen" | "multiply" | "saturation" | "color" | "overlay"; o: number }

const GRAY = "#808080"
const hue = (k: string) => moodHue(k)

/**
 * THE MAPPING: a grade per Discover mood, tinted with the mood's own hue (`~/domain/moods`). Every other choice
 * (themes, styles, genres, a search's reading) lands on one of these (GRADE_OF_VOCAB, GRADE_OF_KEY, GRADE_WORDS).
 * Layers stack bottom to top; each fades in and out on its own (opacity only), so a change crossfades.
 */
const GRADES: Record<string, Layer[]> = {
	// Warmer and a touch brighter.
	feelgood: [
		{ bg: hue("feelgood"), blend: "soft-light", o: 0.5 },
		{ bg: "rgb(255 196 130)", blend: "screen", o: 0.1 },
	],
	// Sunny: yellow warmth, a little light.
	funny: [
		{ bg: hue("funny"), blend: "soft-light", o: 0.42 },
		{ bg: "rgb(255 236 150)", blend: "screen", o: 0.08 },
	],
	// Rose-warm.
	romance: [
		{ bg: hue("romance"), blend: "soft-light", o: 0.5 },
		{ bg: "rgb(255 150 190)", blend: "screen", o: 0.06 },
	],
	// Hot and punchier: red overlay (adds contrast), deeper shadows.
	action: [
		{ bg: hue("action"), blend: "overlay", o: 0.24 },
		{ bg: "rgb(40 10 10)", blend: "soft-light", o: 0.45 },
	],
	// Colder, darker, a little drained, with the mood's sickly green in the shadows.
	scary: [
		{ bg: GRAY, blend: "saturation", o: 0.45 },
		{ bg: "rgb(30 52 72)", blend: "multiply", o: 0.55 },
		{ bg: hue("scary"), blend: "soft-light", o: 0.16 },
	],
	// Cool noir: most color gone, a blue cast, darker.
	crime: [
		{ bg: GRAY, blend: "saturation", o: 0.45 },
		{ bg: hue("crime"), blend: "color", o: 0.32 },
		{ bg: "rgb(20 30 50)", blend: "multiply", o: 0.32 },
	],
	// A violet cast.
	mind: [
		{ bg: hue("mind"), blend: "color", o: 0.26 },
		{ bg: hue("mind"), blend: "soft-light", o: 0.4 },
	],
	// Muted and dim.
	heavy: [
		{ bg: GRAY, blend: "saturation", o: 0.6 },
		{ bg: "rgb(52 58 70)", blend: "multiply", o: 0.38 },
	],
	// Otherworldly teal.
	worlds: [
		{ bg: hue("worlds"), blend: "soft-light", o: 0.45 },
		{ bg: "rgb(20 60 80)", blend: "multiply", o: 0.18 },
	],
	// Sepia: drained a little, then warmed brown.
	history: [
		{ bg: GRAY, blend: "saturation", o: 0.4 },
		{ bg: hue("history"), blend: "soft-light", o: 0.55 },
	],
	// Soft pastel light.
	growing: [
		{ bg: hue("growing"), blend: "soft-light", o: 0.38 },
		{ bg: "rgb(255 220 250)", blend: "screen", o: 0.09 },
	],
}

/** More moods' themes, styles and genres onto a grade (by vocabulary id); unlisted ones tint with their own color. */
const GRADE_OF_VOCAB: Record<string, string | null> = {
	"theme:crime": "crime",
	"theme:mystery": "crime",
	"theme:war": "heavy",
	"theme:politics": "crime",
	"theme:true": "history",
	"theme:history": "history",
	"theme:growing": "growing",
	"theme:family": "feelgood",
	"theme:mind": "mind",
	"theme:showbiz": "funny",
	"theme:sports": "action",
	"theme:money": "crime",
	"theme:future": "worlds",
	"theme:fantasy": "worlds",
	"style:animated": "growing",
	"style:documentary": null,
	"style:spectacle": "action",
	"style:stylized": "mind",
	"style:music": "romance",
	"style:slow": "heavy",
	"style:fast": "action",
	"style:talky": null,
	"style:nonlinear": "mind",
	"style:graphic": "scary",
	"genre:adventure": "worlds",
	"genre:comedy": "funny",
	"genre:drama": "heavy",
	"genre:horror": "scary",
	"genre:music": "romance",
	"genre:mystery": "crime",
	"genre:science-fiction": "worlds",
	"genre:thriller": "crime",
	"genre:war": "heavy",
	"genre:western": "history",
	"genre:documentary": null,
}

/** A reading's fingerprint keys (the "want" chips) onto a grade; the grade with the most keys wins, first seen on a tie. */
const GRADE_OF_KEY: Record<string, string> = {
	scare: "scary",
	uncanny: "scary",
	grotesque: "scary",
	tension: "crime",
	crime: "crime",
	mystery: "crime",
	intrigue: "crime",
	adrenaline: "action",
	violence: "action",
	fast_pace: "action",
	spectacle: "action",
	romance: "romance",
	eroticism: "romance",
	wholesome: "feelgood",
	hopefulness: "feelgood",
	nostalgia: "feelgood",
	situational_comedy: "funny",
	wit_wordplay: "funny",
	physical_comedy: "funny",
	absurdist_humor: "funny",
	satire_parody: "funny",
	melancholy: "heavy",
	pathos: "heavy",
	bleakness: "heavy",
	catharsis: "heavy",
	warfare: "heavy",
	wonder: "worlds",
	fantasy: "worlds",
	futuristic: "worlds",
	world_immersion: "worlds",
	psychological: "mind",
	surrealism: "mind",
	psychedelic: "mind",
	complexity: "mind",
	non_linear_narrative: "mind",
	meta_narrative: "mind",
	philosophical: "mind",
	historical: "history",
	biographical: "history",
	coming_of_age: "growing",
	family_dynamics: "growing",
}

/** A search without a reading: the first of these words in the text names the grade (the fixtures' stand-in). */
const GRADE_WORDS: [RegExp, string][] = [
	[/\b(cozy|cosy|feel-?good|comfort|wholesome|uplifting|warm)/, "feelgood"],
	[/\b(funn|comed|laugh|hilari|silly)/, "funny"],
	[/\b(romanc|romantic|love|date night|partner)/, "romance"],
	[/\b(action|explosi|chase|heist|adrenaline)/, "action"],
	[/\b(scary|horror|creepy|spooky|halloween|terrify)/, "scary"],
	[/\b(dark|thriller|noir|crime|detective|murder|mystery|mob)/, "crime"],
	[/\b(mind-?(bending|blowing)|twist|trippy|puzzle|surreal)/, "mind"],
	[/\b(sad|cry|tearjerk|bleak|heavy|grief)/, "heavy"],
	[/\b(space|sci-?fi|fantasy|alien|magic|dragon|epic)/, "worlds"],
	[/\b(histor|period|war|biopic|true story)/, "history"],
	[/\b(teen|coming of age|school|kids|family|animated)/, "growing"],
]

const MOOD_KEY_BY_NAME = new Map(MOODS.map((m) => [m.name, m.key]))

const gradeOfReading = (reading: unknown): string | null => {
	if (!Array.isArray(reading)) return null
	const tally = new Map<string, number>()
	for (const chip of reading as { kind?: string; key?: string }[]) {
		const g = chip?.kind === "want" && chip.key ? GRADE_OF_KEY[chip.key] : undefined
		if (g) tally.set(g, (tally.get(g) ?? 0) + 1)
	}
	let best: string | null = null
	for (const [g, n] of tally) if (!best || n > (tally.get(best) ?? 0)) best = g
	return best
}

const gradeOfText = (q: string): string | null => {
	const t = q.toLowerCase()
	let best: { g: string; at: number } | null = null
	for (const [re, g] of GRADE_WORDS) {
		const m = re.exec(t)
		if (m && (!best || m.index < best.at)) best = { g, at: m.index }
	}
	return best?.g ?? null
}

/** A grade key for what's on show: a mood key, `color:<hex>`, null for neutral, or undefined while a search reads. */
function gradeOf(f: JkFlow): string | null | undefined {
	const s = f.source
	if (s.kind === "popular") return null
	if (s.kind === "mood") return GRADES[s.key] ? s.key : null
	const v = vocabOf(s)
	if (v) {
		if (v.moodKey) return GRADES[v.moodKey] ? v.moodKey : null
		return v.id in GRADE_OF_VOCAB ? GRADE_OF_VOCAB[v.id] : `color:${v.color}`
	}
	// A typed search grades when its reading arrives (the room reacts to what was read), not on every keystroke.
	if (f.loading && !f.reading) return undefined
	const reading = f.loading ? f.reading : f.answer?.reading
	const answeredMood = f.answer?.kind === "mood" ? MOOD_KEY_BY_NAME.get(f.answer.answeredAs as never) : undefined
	return gradeOfReading(reading) ?? gradeOfText(s.q) ?? answeredMood ?? null
}

const layersOf = (g: string): Layer[] =>
	g.startsWith("color:") ? [{ bg: g.slice(6), blend: "soft-light", o: 0.4 }] : (GRADES[g] ?? [])

const CSS = `.jk-grade{position:absolute;inset:0;pointer-events:none;transition:opacity .6s ease-out}
@media (prefers-reduced-motion:reduce){.jk-grade{transition:none}}`

/**
 * The grade layers, between the room and the night above it. A grade's layers mount the first time it's used (at
 * opacity 0, then faded in) and stay, so moving between grades is a crossfade. The layers sit straight in this
 * wrapper, which makes no stacking context, so they blend with the room under them.
 */
export function JkGrade({ f }: { f: JkFlow }) {
	const wanted = gradeOf(f)
	const last = useRef<string | null>(null)
	if (wanted !== undefined) last.current = wanted
	const target = wanted === undefined ? last.current : wanted
	const [mounted, setMounted] = useState<string[]>([])
	const [on, setOn] = useState<string | null>(null)
	useEffect(() => {
		if (target && !mounted.includes(target)) {
			setMounted((m) => [...m, target])
			// Two frames: the new layers paint at 0 before they fade in.
			let r2 = 0
			const r1 = requestAnimationFrame(() => {
				r2 = requestAnimationFrame(() => setOn(target))
			})
			return () => {
				cancelAnimationFrame(r1)
				cancelAnimationFrame(r2)
			}
		}
		setOn(target)
	}, [target, mounted])
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0" data-jk-grade={on ?? "none"}>
			<style>{CSS}</style>
			{mounted.flatMap((g) =>
				layersOf(g).map((l, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: a grade's layers are fixed
						key={`${g}-${i}`}
						className="jk-grade"
						style={{ background: l.bg, mixBlendMode: l.blend, opacity: on === g ? l.o : 0 }}
					/>
				)),
			)}
		</div>
	)
}
