// PROTOTYPE - throwaway.
// It is / it isn't: big contrast pairs ("Tense, not scary.") from high vs. low traits, plus what it is and what it isn't.
import { useState } from "react"
import { HEX } from "~/ui/details/DetailsFingerprint"
import type * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { GoodForLine, type Key, type Scores, TraitBars, areaColor, areaOf } from "./versus-parts"

const HUMOR: Key[] = ["situational_comedy", "wit_wordplay", "physical_comedy", "absurdist_humor", "satire_parody", "dark_humor"]
const maxOf = (s: Scores, ks: Key[]) => Math.max(...ks.map((k) => s[k]))
const argMax = (s: Scores, ks: Key[]) => [...ks].sort((a, b) => s[b] - s[a])[0]

interface Pair {
	a: string
	conj: "not" | "but" | "with"
	b: string
	// The trait that makes the first word true, and the one that makes the second true or false.
	hi: (s: Scores) => Key
	other: (s: Scores) => Key
	ok: (s: Scores, t: F.TitleInput) => boolean
	// Higher is a stronger, more surprising contrast.
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
		// Two highs that rarely meet: weigh like a difference of about 4.
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

// Up to three pairs that don't share a trait.
function pickPairs(s: Scores, t: F.TitleInput) {
	const used = new Set<Key>()
	const out: { p: Pair; hi: Key; other: Key }[] = []
	const ranked = PAIRS.filter((p) => p.ok(s, t)).sort((x, y) => y.score(s) - x.score(s))
	for (const p of ranked) {
		const hi = p.hi(s)
		const other = p.other(s)
		if (used.has(hi) || used.has(other)) continue
		used.add(hi)
		used.add(other)
		out.push({ p, hi, other })
		if (out.length === 3) break
	}
	return out
}

// --- It is ---

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

function isWords(s: Scores, hl: string[], skip: Key[]) {
	const keys = (Object.keys(IS_WORD) as Key[]).filter((x) => s[x] >= 7 && !skip.includes(x))
	return keys
		.sort((a, b) => s[b] + (hl.includes(b) ? 1.5 : 0) - (s[a] + (hl.includes(a) ? 1.5 : 0)))
		.slice(0, 4)
		.map((x) => ({ key: x, word: IS_WORD[x] ?? "" }))
}

// --- It isn't: low traits a viewer might expect from the genre, then the plainest absences ---

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

function isntWords(t: F.TitleInput, skip: Key[]) {
	const s = t.fingerprint.scores
	const expected = new Set(t.genres.flatMap((g) => GENRE_EXPECTS[g] ?? []))
	// For a kids' title, "not steamy" or "not gory" goes without saying.
	const kids = t.fingerprint.socialSuitability.some((x) => x.name === "Kids")
	const obvious: Key[] = kids ? ["eroticism", "grotesque", "violence"] : []
	const cand = ISNT.filter((x) => !skip.includes(x.key) && !obvious.includes(x.key) && x.value(s) <= (expected.has(x.key) ? 4 : 3))
	// Expected-by-genre absences are the surprising ones, so they lead.
	return cand
		.sort((a, b) => Number(expected.has(b.key)) - Number(expected.has(a.key)) || a.value(s) - b.value(s))
		.slice(0, 4)
		.map((x) => ({ key: x.key, word: x.word, expected: expected.has(x.key), score: x.value(s) }))
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

export default function Versus({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const hl = (media.fingerprint as { highlightKeys?: string[] } | null)?.highlightKeys ?? []
	const [open, setOpen] = useState<number | null>(null)
	let pairs = pickPairs(s, t)
	// The columns add to the pairs rather than repeat them.
	const used = pairs.flatMap((x) => [x.hi, x.other])
	const is = isWords(s, hl, used)
	const isnt = isntWords(t, used)
	// Fallback: the strongest trait against the most surprising absence.
	if (pairs.length === 0 && is[0] && isnt[0])
		pairs = [
			{
				p: { a: cap(is[0].word), conj: "not", b: isnt[0].word, hi: k(is[0].key), other: k(isnt[0].key), ok: () => true, score: () => 0 },
				hi: is[0].key,
				other: isnt[0].key,
			},
		]

	return (
		<div onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
			<SectionTitle t={t} />
			<div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
				<ul className="space-y-1">
					{pairs.map(({ p, hi, other }, i) => {
						const on = open === i
						const color = HEX[areaOf(hi)]
						return (
							<li key={p.a + p.b}>
								<button
									type="button"
									aria-expanded={on}
									aria-controls={`versus-${i}`}
									onClick={() => setOpen(on ? null : i)}
									className="group -mx-2 cursor-pointer rounded-xl px-2 py-1 text-left hover:bg-white/4 focus-visible:outline-2 focus-visible:outline-amber-300"
								>
									<span className="text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">
										<span style={{ color }}>{p.a},</span>{" "}
										<span className={p.conj === "not" ? "text-gray-500" : "text-white"}>
											{p.conj} {p.b.split(" ").slice(0, -1).join(" ")}{" "}
											<span className="whitespace-nowrap">
												{p.b.split(" ").at(-1)}.
												<span
													aria-hidden="true"
													className={`ml-3 inline-flex h-6 w-6 translate-y-[-0.35em] items-center justify-center rounded-full border border-white/15 align-middle text-sm font-normal text-gray-400 transition-transform group-hover:border-white/40 group-hover:text-white ${on ? "rotate-45" : ""}`}
												>
													+
												</span>
											</span>
										</span>
									</span>
								</button>
								{on && (
									<div
										id={`versus-${i}`}
										className="mb-3 mt-1 grid max-w-xl gap-x-8 gap-y-2 rounded-xl border border-white/10 p-4 sm:grid-cols-2 animate-[vsIn_160ms_ease-out]"
										style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 12%, transparent), transparent 70%)` }}
									>
										<style>{"@keyframes vsIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
										<TraitBars keys={[hi]} s={s} />
										<TraitBars keys={[other]} s={s} low={s[other] <= 4 ? [other] : []} />
									</div>
								)}
							</li>
						)
					})}
				</ul>

				<div className="grid grid-cols-2 gap-6 self-start lg:mt-2">
					<section>
						<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">It is</h3>
						<ul className="mt-2 space-y-1">
							{is.map((x) => (
								<li key={x.key} className="flex items-center gap-2 text-lg font-semibold text-white sm:text-xl">
									<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: areaColor(x.key) }} aria-hidden="true" />
									{cap(x.word)}
								</li>
							))}
						</ul>
					</section>
					<section>
						<h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">It isn't</h3>
						<ul className="mt-2 space-y-1">
							{isnt.map((x) => (
								<li
									key={x.key}
									title={x.expected ? `Unusual for the genre: ${x.score} of 10` : `${x.score} of 10`}
									className="flex items-center gap-2 text-lg font-semibold text-gray-500 sm:text-xl"
								>
									<span className="h-2.5 w-2.5 shrink-0 rounded-full border border-gray-500" aria-hidden="true" />
									{cap(x.word)}
								</li>
							))}
						</ul>
					</section>
				</div>
			</div>
			<GoodForLine t={t} className="mt-6" />
		</div>
	)
}
