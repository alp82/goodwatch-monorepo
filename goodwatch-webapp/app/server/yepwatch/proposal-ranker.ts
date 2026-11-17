import type { Candidate, ReasonCode } from "../../../packages/yepwatch-contracts/proposal.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import type { PersonSignal } from "./proposal-person-signal.ts"
import { tastePercentile } from "./proposal-person-signal.ts"
import { MAX_RANKED, qualityPriors, roomJitter, unitFingerprint } from "./proposal-pool.ts"
import { feedbackAdjustment, FEEDBACK_RANK_HEAD, type RoundFeedback } from "./proposal-feedback.ts"

export const RANKER_VERSION = "picks-3"
export const RANK_WEIGHTS = {
	taste: 0.45,
	idea: 0.35,
	quality: 0.25,
	wishlist: 0.08,
	availability: 0.04,
} as const
export const LEAST_MISERY = 0.65
export interface RankIdea {
	id: string
	nickname: string
	rankedKeys: readonly number[]
	wants: readonly string[]
	avoids: readonly string[]
}
export interface ScoreParts {
	taste: number
	minimum: number
	idea: number
	quality: number
	wishlist: number
	availability: number
	feedback: number
	repeat: number
}
export interface Ranked {
	key: number
	score: number
	parts: ScoreParts
	reason: NonNullable<Candidate["reason"]>
	veto: boolean
}
export interface RankInput {
	weights?: { [K in keyof typeof RANK_WEIGHTS]: number }
	leastMisery?: number
	pool: readonly number[]
	snapshot: TitleSnapshot
	people: readonly PersonSignal[]
	ideas: readonly RankIdea[]
	wishlist: ReadonlyMap<number, number>
	sharedServiceKeys?: ReadonlyMap<number, string>
	excluded: ReadonlySet<number>
	/** Recent Nopes per active linked profile, independent of taste confidence. Length is the repeat denominator. */
	nopeProfiles?: readonly ReadonlySet<number>[]
	feedback?: RoundFeedback
	seed: string
	peopleCount: number
	refill?: boolean
	fingerprintKeys?: readonly string[]
	quality?: ReadonlyMap<number, number>
}
export function groupTaste(
	snapshot: Pick<TitleSnapshot, "cosine" | "version"> &
		Partial<Pick<TitleSnapshot, "rowOf" | "cosineAt">>,
	key: number,
	people: readonly PersonSignal[],
	fingerprint?: Float32Array | null,
	leastMisery = LEAST_MISERY,
) {
	let minimum = 1,
		sum = 0,
		n = 0,
		veto = false,
		unseen = 0
	const row = snapshot.rowOf?.(key)
	for (const person of people) {
		if (!person.confidence || person.snapshotVersion !== snapshot.version) continue
		let cosine: number | null
		if (fingerprint === undefined)
			cosine =
				row !== undefined && snapshot.cosineAt
					? snapshot.cosineAt(row, person.vector)
					: snapshot.cosine(key, person.vector)
		else if (fingerprint === null) cosine = null
		else {
			let dot = 0
			for (let d = 0; d < fingerprint.length; d++) dot += fingerprint[d] * person.vector[d]
			cosine = dot
		}
		const p = cosine == null ? 0.5 : tastePercentile(cosine, person.quantiles)
		const c = Math.max(0, Math.min(1, person.confidence)),
			shrunk = c * p + (1 - c) * 0.5
		minimum = Math.min(minimum, shrunk)
		sum += shrunk
		n++
		// Only raw percentiles determine vetoes.
		veto ||= c >= 0.5 && p < 0.15
		if (p > 0.7 && person.unseen.has(key)) unseen = 0.05
	}
	return {
		taste: n ? leastMisery * minimum + ((1 - leastMisery) * sum) / n + unseen : 0,
		minimum: n ? minimum : 0,
		count: n,
		veto,
	}
}
export function ideaFit(
	rank: number | undefined,
	length: number,
	wants: readonly string[],
	avoids: readonly string[],
	fp: Uint8Array | null,
	dimensions: ReadonlyMap<string, number>,
) {
	let fit = rank === undefined ? 0 : 1 - rank / Math.max(1, length)
	const strong = (keys: readonly string[]) =>
		fp &&
		keys.some((key) => {
			const at = dimensions.get(key.replace(/^(want|avoid):/, ""))
			return at !== undefined && fp[at] !== 255 && fp[at] >= 7
		})
	if (strong(wants)) fit = Math.min(1, fit + 0.1)
	if (strong(avoids)) fit -= 0.3
	return fit
}
export function candidateReason(input: {
	wishlist: number
	peopleCount: number
	tasteCount: number
	minimum: number
	idea: number
	nickname?: string
	short: boolean
	service?: string
	score: number
}): NonNullable<Candidate["reason"]> {
	let code: ReasonCode = "popular_now",
		text = "Popular right now"
	if (input.wishlist > 0 && input.peopleCount >= 3) {
		code = "want_to_see"
		text = "On someone's Want to See list"
	} else if (input.tasteCount >= 2 && input.minimum >= 0.7) {
		code = "fits_everyone"
		text = input.tasteCount === 2 ? "Fits both of you" : `Fits all ${input.tasteCount} of you`
	} else if (input.idea >= 0.5 && input.nickname) {
		code = "fits_idea"
		text = `Fits ${input.nickname.slice(0, 40)}'s idea`
	} else if (input.tasteCount === 1 && input.minimum >= 0.75) {
		code = "close_to_your_taste"
		text = "Close to your taste"
	} else if (input.short) {
		code = "short_episodes"
		text = "Short episodes, easy to start"
	} else if (input.service) {
		code = "on_service_for_everyone"
		text = `On ${input.service.slice(0, 60)} for everyone`
	} else if (input.score >= 80) {
		code = "well_liked"
		text = "Well liked on GoodWatch"
	}
	return { code, text }
}
export function rankDeck(input: RankInput, limit: number): Ranked[] {
	const { snapshot, ideas } = input,
		c = snapshot.columns,
		weights = input.weights ?? RANK_WEIGHTS
	// Idea membership constrains the pool before the scan budget; taste and quality rank only those results.
	const ideaKeys = ideas.length ? new Set(ideas.flatMap((idea) => [...idea.rankedKeys])) : null
	const pool = input.pool
		.filter((k) => !input.excluded.has(k) && (!ideaKeys || ideaKeys.has(k)))
		.slice(0, MAX_RANKED)
	const quality = input.quality ?? qualityPriors(snapshot, pool)
	const dimensions = new Map((input.fingerprintKeys ?? []).map((key, at) => [key, at]))
	const lanes = ideas.map((idea) => ({
		idea,
		ranks: new Map(idea.rankedKeys.map((key, at) => [key, at])),
	}))
	const fits = new Map<number, number[]>()
	const ranked = pool
		.map((key) => {
			const row = snapshot.rowOf(key),
				taste = groupTaste(snapshot, key, input.people, undefined, input.leastMisery)
			const ideaFits = lanes.map(({ idea, ranks }) =>
				ideaFit(
					ranks.get(key),
					idea.rankedKeys.length,
					idea.wants,
					idea.avoids,
					snapshot.fingerprint(key),
					dimensions,
				),
			)
			fits.set(key, ideaFits)
			const idea = ideaFits.length ? Math.max(...ideaFits) : 0,
				best = ideaFits.indexOf(idea)
			// All active linked profiles count, including people without a taste signal.
			const profiles = input.nopeProfiles ?? []
			const nopers = profiles.filter((nopes) => nopes.has(key)).length
			const repeat = nopers ? -0.1 * (nopers / profiles.length) : 0
			const parts: ScoreParts = {
				taste: taste.taste,
				minimum: taste.minimum,
				idea,
				quality: quality.get(key) ?? 0,
				wishlist: Math.min(1, (input.wishlist.get(key) ?? 0) / 2),
				availability: Number(input.sharedServiceKeys?.has(key) ?? false),
				feedback: 0,
				repeat,
			}
			const score =
				weights.taste * parts.taste +
				(ideas.length ? weights.idea : 0) * parts.idea +
				(weights.quality + (taste.count ? 0 : weights.taste)) * parts.quality +
				weights.wishlist * parts.wishlist +
				weights.availability * parts.availability +
				roomJitter(input.seed, key) +
				parts.feedback +
				parts.repeat
			return {
				key,
				score,
				parts,
				veto: taste.veto,
				reason: candidateReason({
					wishlist: parts.wishlist,
					peopleCount: input.peopleCount,
					tasteCount: taste.count,
					minimum: taste.minimum,
					idea,
					nickname: ideas[best]?.nickname,
					short: key >= 2e12 && !!c.facts?.lengths[row] && c.facts.lengths[row] <= 30,
					service: input.sharedServiceKeys?.get(key),
					score: c.scores[row],
				}),
			}
		})
		.filter((r) => input.refill || !r.veto)
		.sort((a, b) => b.score - a.score || a.key - b.key)
	// Feedback refines the next refill's contenders, with work independent of the
	// pool size and round length. Feedback vectors were normalized once by roundFeedback.
	if (input.feedback && (input.feedback.yeps.length || input.feedback.nopes.length)) {
		for (let i = 0; i < Math.min(ranked.length, FEEDBACK_RANK_HEAD); i++) {
			const r = ranked[i]
			r.parts.feedback = feedbackAdjustment(
				snapshot,
				r.key,
				input.feedback,
				unitFingerprint(snapshot, r.key),
			)
			r.score += r.parts.feedback
		}
		ranked.sort((a, b) => b.score - a.score || a.key - b.key)
	}
	// Greedy diversity only over the top 200; precompute unit vectors once, not for each pair.
	const head = ranked.slice(0, 200),
		tail = ranked.slice(200),
		picked: Ranked[] = []
	const vectors = new Map(head.map((r) => [r.key, unitFingerprint(snapshot, r.key)]))
	const slots = new Map(head.map((r, i) => [r.key, i]))
	const similarities: Float32Array[] = []
	let kindRun = 0,
		lastKind = false
	while (head.length && picked.length < Math.min(limit, 200)) {
		let best = -1,
			bestScore = -Infinity
		const lane = picked.length < 2 * ideas.length ? picked.length % ideas.length : -1
		const laneAvailable = lane >= 0 && head.some((r) => (fits.get(r.key)?.[lane] ?? 0) > 0)
		const otherKind = head.some((r) => r.key >= 2e12 !== lastKind)
		for (let i = 0; i < head.length; i++) {
			const r = head[i]
			if (laneAvailable && (fits.get(r.key)?.[lane] ?? 0) <= 0) continue
			if (kindRun >= 3 && otherKind && r.key >= 2e12 === lastKind) continue
			let penalty = 0
			const slot = slots.get(r.key)!
			for (let p = 0; p < similarities.length; p++)
				if (similarities[p][slot] > penalty) penalty = similarities[p][slot]
			if (r.score - penalty > bestScore) {
				bestScore = r.score - penalty
				best = i
			}
		}
		if (best < 0)
			best = kindRun >= 3 && otherKind ? head.findIndex((r) => r.key >= 2e12 !== lastKind) : 0
		const r = head.splice(best, 1)[0],
			kind = r.key >= 2e12
		const vector = vectors.get(r.key),
			near = new Float32Array(200)
		if (vector)
			for (const remaining of head) {
				const other = vectors.get(remaining.key)
				if (!other) continue
				let dot = 0
				for (let d = 0; d < vector.length; d++) dot += vector[d] * other[d]
				near[slots.get(remaining.key)!] = Math.max(0, dot - 0.85)
			}
		similarities.push(near)
		if (similarities.length > 5) similarities.shift()
		kindRun = kind === lastKind ? kindRun + 1 : 1
		lastKind = kind
		picked.push(r)
	}
	return [...picked, ...head, ...tail].slice(0, limit)
}
