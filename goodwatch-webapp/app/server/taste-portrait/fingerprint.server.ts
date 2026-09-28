// Fingerprint: the person's 74 attributes against everyone, in the five fingerprint families, with the titles that
// carry each attribute for them, the exception to their usual stance, and an identity named from the family results.
import type { TitleKey } from "~/server/title-snapshot/index.server"
import { FAMILIES, familyOf } from "./families.server"
import {
	K,
	KEYS,
	type Person,
	type RatedTitle,
	average,
	round1,
	round2,
} from "./person.server"
import type { FingerprintAttribute, FingerprintView, Tier } from "./view"
import {
	capitalize,
	isWorded,
	joinWords,
	label,
	meaning,
	noun,
	persona,
	phrase,
} from "./words.server"

type FingerprintResult = Omit<FingerprintView, "titles" | "subject">

/** Below this many rated titles with a title analysis, the tab shows its empty state. */
const MIN_RATED = 5
const CARRIERS = 6
const AGAINST = 4
const MOST_YOU = 16
// Only well-known titles that aren't adult illustrate an attribute; every rating still counts toward the edges.
const SHOWABLE_VOTES = 300

const rms = (v: ArrayLike<number>) => {
	let squares = 0
	for (let k = 0; k < v.length; k++) squares += v[k] * v[k]
	return Math.sqrt(squares / v.length) || 1
}

function tierOf(normalized: number): Tier {
	const size = Math.abs(normalized)
	const step = size > 1.6 ? 3 : size > 0.8 ? 2 : size > 0.35 ? 1 : 0
	return (normalized < 0 ? -step : step) as Tier
}

export function buildFingerprint(person: Person): FingerprintResult {
	const { rated, mu, sigma, snapshot } = person
	const empty: FingerprintResult = {
		tab: "fingerprint",
		status: "empty",
		identity: null,
		line: "",
		seek: [],
		avoid: [],
		families: FAMILIES,
		attributes: [],
		mostYou: [],
	}
	if (rated.length < MIN_RATED) return empty

	// Edge per attribute: half how much more they choose it than everyone does, half how much higher they rate it than
	// their usual, each scaled to the person's own spread so neither drowns the other.
	const { everyone, threshold, share: everyoneShare } = snapshot.stats
	const chosenGap = Float64Array.from(
		person.selection,
		(x, k) => x - everyone[k],
	)
	const chosenScale = rms(chosenGap)
	const preferenceScale = rms(person.preference)
	const edge = Float64Array.from(
		chosenGap,
		(x, k) =>
			0.5 * (x / chosenScale) + 0.5 * (person.preference[k] / preferenceScale),
	)
	const edgeScale = rms(edge)

	const showable = (r: RatedTitle) =>
		r.facts.hasPoster && !r.facts.adult && r.facts.votes >= SHOWABLE_VOTES
	const liked = rated.filter((r) => r.score >= Math.max(mu, 7) && showable(r))
	const disliked = [
		...rated.filter((r) => r.score <= mu - sigma),
		...[...person.input.skipped].flatMap((key) => {
			if (person.input.scores.has(key)) return []
			const z = person.zOf(key)
			const fingerprint = snapshot.fingerprint(key)
			const facts = snapshot.facts(key)
			return z && fingerprint && facts
				? [{ key, score: 0, z, fingerprint, facts }]
				: []
		}),
	].filter(showable)
	const scoreOf = (r: RatedTitle) => (r.score > 0 ? r.score : mu)

	// A title already shown for another attribute ranks lower, so one broad favorite doesn't illustrate everything.
	const shownCount = new Map<TitleKey, number>()
	const pick = (
		from: RatedTitle[],
		rank: (r: RatedTitle) => number,
		n: number,
	) => {
		const picked = from
			.map((r) => ({ r, value: rank(r) - 1.2 * (shownCount.get(r.key) ?? 0) }))
			.sort((a, b) => b.value - a.value || a.r.key - b.r.key)
			.slice(0, n)
			.map((x) => x.r)
		for (const r of picked)
			shownCount.set(r.key, (shownCount.get(r.key) ?? 0) + 1)
		return picked.map((r) => r.key)
	}

	const attributes = new Array<FingerprintAttribute>(K)
	const exceptions = new Set<TitleKey>()
	// The strongest edges pick their titles first.
	const order = KEYS.map((_, k) => k).sort(
		(a, b) => Math.abs(edge[b]) - Math.abs(edge[a]) || a - b,
	)
	for (const k of order) {
		const key = KEYS[k]
		const strong = rated.filter(
			(r) => r.fingerprint[k] !== 255 && r.fingerprint[k] >= threshold[k],
		)
		const carriers = pick(
			liked.filter((r) => r.fingerprint[k] !== 255 && r.fingerprint[k] >= 6),
			(r) => r.z[k] + 0.15 * (scoreOf(r) - mu),
			CARRIERS,
		)
		const against = pick(
			disliked.filter((r) => r.fingerprint[k] !== 255 && r.fingerprint[k] >= 6),
			(r) => r.z[k] - 0.15 * (scoreOf(r) - mu),
			AGAINST,
		)
		// Against their usual stance: loved although they avoid it, or disliked although they seek it.
		const avoided = edge[k] < 0
		const exception =
			rated
				.filter(
					(r) =>
						showable(r) &&
						r.fingerprint[k] !== 255 &&
						r.fingerprint[k] >= 7 &&
						(avoided
							? r.score >= Math.max(8, mu + sigma)
							: r.score <= Math.min(5, mu - sigma)),
				)
				.sort(
					(a, b) =>
						(avoided ? b.score - a.score : a.score - b.score) ||
						b.fingerprint[k] - a.fingerprint[k] ||
						a.key - b.key,
				)
				.find((r) => !exceptions.has(r.key))?.key ?? null
		if (exception !== null) exceptions.add(exception)
		attributes[k] = {
			key,
			label: label(key),
			family: familyOf(key),
			meaning: meaning(key),
			phrase: phrase(key),
			noun: noun(key),
			edge: round2(edge[k]),
			tier: tierOf(edge[k] / edgeScale),
			share: round2(strong.length / rated.length),
			everyoneShare: round2(everyoneShare[k]),
			lift:
				strong.length >= 3
					? round1(average(strong.map((r) => r.score)) - mu)
					: null,
			count: strong.length,
			carriers,
			against,
			exception,
		}
	}

	// The line names what they seek and avoid most; the identity is named from the same family results.
	const worded = attributes.filter((a) => isWorded(a.key))
	const byEdge = [...worded].sort(
		(a, b) => b.edge - a.edge || a.key.localeCompare(b.key),
	)
	const seek = byEdge.filter((a) => a.edge > 0).slice(0, 3)
	const avoid = byEdge
		.filter((a) => a.edge < 0)
		.reverse()
		.slice(0, 2)
	const first = `Show you ${joinWords(
		seek.map((a) => a.phrase),
		"or",
	)}, and you're in.`
	const line = seek.length
		? avoid.length
			? `${first} ${capitalize(joinWords(avoid.map((a) => a.noun)))} rarely get a look.`
			: first
		: ""

	// Describe the strongest viewing preference, supported by a positive edge in another family.
	// Keep both evidence keys, but do not apply a title adjective to the person.
	const leaning = byEdge.filter((a) => a.tier >= 1)
	const top = leaning[0]
	const second = leaning.find((a) => top && a.family !== top.family)
	const identity =
		top && second
			? {
					name: `The ${persona(top.key)}`,
					persona: top.key,
					adjective: second.key,
				}
			: null

	// The titles that are most them: two rows of eight, in turns over the sought attributes' carriers.
	const sought = [
		...seek.map((a) => a.key),
		...[...attributes]
			.filter((a) => a.tier >= 2 && !seek.some((s) => s.key === a.key))
			.sort((a, b) => b.edge - a.edge)
			.map((a) => a.key),
	]
	const byKey = new Map(attributes.map((a) => [a.key, a]))
	const mostYou: TitleKey[] = []
	for (let i = 0; i < CARRIERS && mostYou.length < MOST_YOU; i++)
		for (const key of sought) {
			const carrier = byKey.get(key)?.carriers[i]
			if (carrier !== undefined && !mostYou.includes(carrier))
				mostYou.push(carrier)
			if (mostYou.length >= MOST_YOU) break
		}

	return {
		...empty,
		status: "ready",
		identity,
		line,
		seek: seek.map((a) => a.key),
		avoid: avoid.map((a) => a.key),
		attributes,
		mostYou,
	}
}
