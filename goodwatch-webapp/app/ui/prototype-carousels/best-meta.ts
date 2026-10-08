// PROTOTYPE for "Prototype native-scroll carousels on title pages", ninth round. Throwaway code: not for production.
//
// What the ninth round's forms (best1 to best3) and their pack know beyond the play engine's vocabulary: the twenty
// fingerprint attributes that read as "more" and "less" of something, each with a plain word, and the rule that
// picks four of them for a title. Handed to the forms as plain data, because they run as an inline script.

export const BEST_NAMES: Record<string, string> = {
	best1: "B1 Trait strip",
	best2: "B2 Trait compass",
	best3: "B3 More, less",
}

/**
 * The traits a form may offer: a plain word and an emoji of its own. In the order of how often "more of it" is
 * something a visitor asks for, which breaks ties when a title has several traits at the same level.
 */
export const BEST_WORDS: [string, string, string][] = [
	["situational_comedy", "Comedy", "😂"],
	["romance", "Romance", "💘"],
	["hopefulness", "Hope", "🌤️"],
	["scare", "Scares", "😱"],
	["wholesome", "Warmth", "🤗"],
	["wit_wordplay", "Wit", "💬"],
	["surrealism", "Surreal", "🌀"],
	["adrenaline", "Adrenaline", "⚡"],
	["tension", "Tension", "😬"],
	["wonder", "Wonder", "✨"],
	["dark_humor", "Dark humor", "💀"],
	["complexity", "Complexity", "🧩"],
	["violence", "Violence", "🩸"],
	["spectacle", "Spectacle", "🎆"],
	["fast_pace", "Pace", "🏎️"],
	["slow_burn", "Slow burn", "🕯️"],
	["absurdist_humor", "Absurdity", "🤪"],
	["bleakness", "Bleakness", "🌫️"],
	["melancholy", "Melancholy", "🌧️"],
	["dialogue_centrality", "Talk", "🗣️"],
]

/** Traits of one family tell much the same story, so a title is offered at most one of each. */
const FAMILIES = [
	["bleakness", "violence", "scare", "melancholy"],
	["hopefulness", "wholesome", "romance", "wonder"],
	["situational_comedy", "wit_wordplay", "dark_humor", "absurdist_humor"],
	["tension", "adrenaline", "fast_pace", "slow_burn"],
	["complexity", "surrealism", "spectacle", "dialogue_centrality"],
]

export interface BestExtra {
	/** Per trait: its plain word and its emoji. */
	w: Record<string, [string, string]>
}

export function bestExtra(): BestExtra {
	const w: BestExtra["w"] = {}
	for (const [key, word, emoji] of BEST_WORDS) w[key] = [word, emoji]
	return { w }
}

const mean = (values: number[]) =>
	values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

/**
 * With `mid`, for the compass: the traits the title has a middling amount of, one per family.
 *
 * Four traits for a title: the two it is strongest on (what it is), and the two it has least of (where else one
 * could go), each from another family. A trait that runs with or against one already taken among the nearest
 * titles is skipped: it would lay the same titles out a second time.
 */
export function bestTraits(
	center: (key: string) => number,
	near: ((key: string) => number)[],
	count = 4,
	mid = false,
): string[] {
	const order = BEST_WORDS.map(([key]) => key)
	const family = (key: string) => FAMILIES.findIndex((f) => f.includes(key))
	const appeal = (key: string) => 2 * (1 - order.indexOf(key) / order.length)
	const correlation = (a: string, b: string) => {
		const x = near.map((s) => s(a))
		const y = near.map((s) => s(b))
		const mx = mean(x)
		const my = mean(y)
		const sx = Math.sqrt(mean(x.map((v) => (v - mx) ** 2)))
		const sy = Math.sqrt(mean(y.map((v) => (v - my) ** 2)))
		return sx && sy
			? mean(x.map((v, i) => (v - mx) * (y[i] - my))) / (sx * sy)
			: 0
	}
	const out: string[] = []
	const free = (key: string, limit = 0.55) =>
		!out.includes(key) &&
		!out.some((taken) => family(taken) === family(key)) &&
		!out.some((taken) => Math.abs(correlation(taken, key)) > limit)
	if (mid) {
		// For a compass: traits the title has a middling amount of, so that both directions have somewhere to go.
		const middling = [...order].sort(
			(a, b) =>
				Math.abs(center(a) - 5) - appeal(a) / 2 - (Math.abs(center(b) - 5) - appeal(b) / 2),
		)
		for (const key of middling) if (out.length < count && free(key)) out.push(key)
		for (const key of middling)
			if (out.length < count && !out.includes(key)) out.push(key)
		return out
	}
	const strong = order
		.filter((key) => center(key) >= 7)
		.sort((a, b) => center(b) - center(a) || order.indexOf(a) - order.indexOf(b))
	for (const key of strong) if (out.length < 2 && free(key)) out.push(key)
	const weak = order
		.filter((key) => center(key) <= 4)
		.sort((a, b) => 10 - center(b) + appeal(b) - (10 - center(a) + appeal(a)))
	for (const key of weak) if (out.length < count && free(key)) out.push(key)
	const rest = [...order].sort(
		(a, b) => Math.abs(center(b) - 5) - Math.abs(center(a) - 5),
	)
	for (const key of rest)
		if (
			out.length < count &&
			!out.includes(key) &&
			!out.some((taken) => Math.abs(correlation(taken, key)) > 0.7)
		)
			out.push(key)
	return out
}

/** Whether two titles belong to one franchise, as far as their names tell: "Toy Story" and "Toy Story 2". */
const stem = (title: string) =>
	title
		.toLowerCase()
		.replace(/^(the|a|an) /, "")
		.replace(/[’']/g, "")
		.split(/:| - | – | — /)[0]
		.replace(/\b(part|chapter|vol\.?|volume|episode|season)\s+[\divxlc]+.*$/, "")
		.replace(/\s+([ivx]+|\d+)$/, "")
		.replace(/[^\w ]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
export function sameFranchise(a: string, b: string): boolean {
	const x = stem(a)
	const y = stem(b)
	if (!x || !y) return false
	if (x === y) return true
	const [short, long] = x.length <= y.length ? [x, y] : [y, x]
	return (
		(short.length >= 6 || short.split(" ").length >= 2) &&
		long.startsWith(`${short} `)
	)
}
