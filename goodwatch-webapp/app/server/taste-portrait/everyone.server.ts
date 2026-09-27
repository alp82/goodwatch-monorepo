// You vs everyone: where the person's ratings part ways with the GoodWatch score ("everyone" is the GoodWatch score,
// not other members), after allowing for how generous they are overall.
import {
	KEYS,
	NON_CRAFT,
	type Person,
	type RatedTitle,
	average,
	round2,
} from "./person.server"
import type { EveryoneGap, EveryoneRow, EveryoneView } from "./view"
import { capitalize, noun } from "./words.server"

type EveryoneResult = Omit<EveryoneView, "titles" | "subject">

const MIN_VOTES = 1000
const LISTED = 30
// A bar needs this many titles; fewer rated titles leave the tab empty.
const MIN_PER_BAR = 4
// Gap bars are drawn only from this many points either way.
const MIN_GAP = 2

export function buildEveryone(person: Person): EveryoneResult {
	const counted = person.rated.filter(
		(r): r is RatedTitle & { facts: { score: number } } =>
			r.facts.score !== null && r.facts.score > 0 && r.facts.votes >= MIN_VOTES,
	)
	const empty: EveryoneResult = {
		tab: "everyone",
		status: "empty",
		headline: "",
		agreement: 0,
		offset: 0,
		counted: counted.length,
		higher: [],
		lower: [],
		attributes: [],
		genres: [],
	}
	if (counted.length < MIN_PER_BAR) return empty

	const gaps = counted.map((r) => r.score * 10 - r.facts.score)
	const offset = average(gaps)
	const rows: (EveryoneRow & { votes: number })[] = counted.map((r, i) => ({
		key: r.key,
		mine: r.score,
		everyone: r.facts.score,
		delta: Math.round(gaps[i] - offset),
		votes: r.facts.votes,
	}))
	// By the gap, nudged toward titles people know, so the lists read as a conversation, not trivia.
	const fame = (row: { votes: number }) =>
		5 * Math.log10(Math.max(1000, row.votes))
	const sorted = [...rows].sort(
		(a, b) =>
			b.delta +
				Math.sign(b.delta) * fame(b) -
				(a.delta + Math.sign(a.delta) * fame(a)) || a.key - b.key,
	)
	const plain = ({ votes, ...row }: EveryoneRow & { votes: number }) => row
	const shown = (row: EveryoneRow) =>
		person.ratedByKey.get(row.key)?.facts.hasPoster
	const higher = sorted
		.filter((r) => r.delta > 0 && shown(r))
		.slice(0, LISTED)
		.map(plain)
	const lower = sorted
		.filter((r) => r.delta < 0 && shown(r))
		.reverse()
		.slice(0, LISTED)
		.map(plain)

	const mine = counted.map((r) => r.score)
	const theirs = counted.map((r) => r.facts.score)
	const mx = average(mine)
	const my = average(theirs)
	const covariance = average(mine.map((x, i) => (x - mx) * (theirs[i] - my)))
	const sx = Math.sqrt(average(mine.map((x) => (x - mx) ** 2))) || 1
	const sy = Math.sqrt(average(theirs.map((y) => (y - my) ** 2))) || 1
	const agreement = round2(covariance / (sx * sy))
	const headline =
		agreement > 0.6
			? "You mostly agree with everyone"
			: agreement > 0.35
				? "You agree about as often as you don't"
				: "You don't take the crowd's word for much"

	// Gap bars: titles that carry an attribute strongly (z above 1), and genres, each with enough titles.
	const minTitles = Math.max(MIN_PER_BAR, Math.round(counted.length * 0.04))
	const byGap = (a: EveryoneGap, b: EveryoneGap) =>
		b.delta - a.delta || a.id.localeCompare(b.id)
	const attributeGaps = NON_CRAFT.map((k): EveryoneGap => {
		const hits = counted.flatMap((r, i) =>
			r.z[k] > 1 ? [gaps[i] - offset] : [],
		)
		return {
			id: KEYS[k],
			name: capitalize(noun(KEYS[k])),
			delta: Math.round(average(hits)),
			count: hits.length,
		}
	})
		.filter((g) => g.count >= minTitles)
		.sort(byGap)
	const byGenre = new Map<string, number[]>()
	counted.forEach((r, i) => {
		for (const genre of r.facts.genres)
			byGenre.set(genre, [...(byGenre.get(genre) ?? []), gaps[i] - offset])
	})
	const genreGaps = [...byGenre]
		.filter(([, deltas]) => deltas.length >= minTitles)
		.map(
			([genre, deltas]): EveryoneGap => ({
				id: genre,
				name: genre,
				delta: Math.round(average(deltas)),
				count: deltas.length,
			}),
		)
		.sort(byGap)
	const ends = (gapList: EveryoneGap[], n: number) =>
		[...gapList.slice(0, n), ...gapList.slice(-n)]
			.filter((g, i, all) => all.findIndex((x) => x.id === g.id) === i)
			.filter((g) => Math.abs(g.delta) >= MIN_GAP)
			.sort(byGap)

	return {
		...empty,
		status: "ready",
		headline,
		agreement,
		offset: Math.round(offset),
		higher,
		lower,
		attributes: ends(attributeGaps, 4),
		genres: ends(genreGaps, 3),
	}
}
