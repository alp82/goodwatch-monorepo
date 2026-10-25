// Per attribute, the rated titles that define it most for the person, and how their scores on the titles carrying it
// compare with the GoodWatch score. Pure: the Fingerprint build (fingerprint.server.ts) passes the titles in.
//
// A title defines an attribute when the attribute stands out within the title: its score for the attribute minus the
// title's own mean over all attributes. Ranking by the raw attribute score instead lets one broad favorite define
// dozens of attributes.

/** A fingerprint score the title analysis left out. */
const MISSING = 255

export interface DefiningCandidate {
	key: number
	/** The person's score, 1 to 10. */
	score: number
	/** The title's fingerprint, one score per attribute; MISSING where the analysis left it out. */
	fingerprint: ArrayLike<number>
}

export interface DefiningAttribute {
	/** The attribute's index in the fingerprint. */
	k: number
	family: string
	/** The person's edge for it: within a family, the strongest pull picks first. */
	edge: number
	/** The titles that carry it strongly for the person. */
	carriers: DefiningCandidate[]
}

export interface DefiningOptions {
	/** Picks per attribute. */
	n?: number
	/** Only titles the person scored this or more. */
	minScore?: number
	/** How many attributes of one family a title may define before the others' lists skip it. */
	perFamily?: number
}

/** A fingerprint's mean over the scores it has. */
export function fingerprintMean(fingerprint: ArrayLike<number>): number {
	let sum = 0
	let n = 0
	for (let k = 0; k < fingerprint.length; k++)
		if (fingerprint[k] !== MISSING) {
			sum += fingerprint[k]
			n++
		}
	return n ? sum / n : 0
}

/**
 * The defining titles per attribute index, up to `n` each. Candidates are the attribute's carriers scored `minScore` or
 * more, ranked by how much the attribute stands out within the title, then by the attribute's score, then by the
 * person's score. Within a family, a title fills at most `perFamily` lists, the strongest pulls taken first; a list the
 * cap leaves short is topped up from its own ranking.
 */
export function definingTitles(
	attributes: DefiningAttribute[],
	{ n = 6, minScore = 7, perFamily = 2 }: DefiningOptions = {},
): Map<number, number[]> {
	const means = new Map<number, number>()
	const meanOf = (t: DefiningCandidate) => {
		let mean = means.get(t.key)
		if (mean === undefined) {
			mean = fingerprintMean(t.fingerprint)
			means.set(t.key, mean)
		}
		return mean
	}
	const ranking = ({ k, carriers }: DefiningAttribute) =>
		carriers
			.filter((t) => t.score >= minScore && t.fingerprint[k] !== MISSING)
			.map((t) => ({ t, stand: t.fingerprint[k] - meanOf(t) }))
			.sort(
				(a, b) =>
					b.stand - a.stand ||
					b.t.fingerprint[k] - a.t.fingerprint[k] ||
					b.t.score - a.t.score ||
					a.t.key - b.t.key,
			)
			.map((x) => x.t.key)

	const families = new Map<string, DefiningAttribute[]>()
	for (const a of attributes)
		families.set(a.family, [...(families.get(a.family) ?? []), a])
	const picks = new Map<number, number[]>()
	for (const list of families.values()) {
		const used = new Map<number, number>()
		for (const a of [...list].sort((x, y) => y.edge - x.edge || x.k - y.k)) {
			const order = ranking(a)
			const picked: number[] = []
			for (const key of order) {
				if (picked.length === n) break
				if ((used.get(key) ?? 0) < perFamily) picked.push(key)
			}
			for (const key of order) {
				if (picked.length === n) break
				if (!picked.includes(key)) picked.push(key)
			}
			for (const key of picked) used.set(key, (used.get(key) ?? 0) + 1)
			picks.set(a.k, picked)
		}
	}
	return picks
}

export interface ScoredAgainstEveryone {
	key: number
	kind: "movie" | "show"
	/** The person's score, 1 to 10. */
	score: number
	/** The GoodWatch score, 0 to 100. */
	everyone: number
}

/**
 * The person's generosity per kind: their mean score times ten minus the GoodWatch score, over their movies and over
 * their shows apart (GoodWatch scores shows higher than movies). A kind without titles has no offset.
 */
export function kindOffsets(titles: ScoredAgainstEveryone[]) {
	const of = (kind: ScoredAgainstEveryone["kind"]) => {
		const gaps = titles
			.filter((t) => t.kind === kind)
			.map((t) => t.score * 10 - t.everyone)
		return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
	}
	return { movie: of("movie"), show: of("show") }
}

/**
 * The person's scores against the GoodWatch score on some titles, after their generosity per kind, on the 1 to 10
 * scale (0.4 is four GoodWatch points); null below `least` titles.
 */
export function scoresVsEveryone(
	titles: ScoredAgainstEveryone[],
	offsets: { movie: number; show: number },
	least = 5,
): number | null {
	if (titles.length < least) return null
	const sum = titles.reduce(
		(total, t) => total + t.score * 10 - t.everyone - offsets[t.kind],
		0,
	)
	return Math.round(sum / titles.length) / 10
}
