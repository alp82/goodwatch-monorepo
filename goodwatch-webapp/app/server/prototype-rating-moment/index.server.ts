// PROTOTYPE - throwaway (#662, map #652). Sides of you at the rating moment: what one new score does to a member's
// sides. Replays the chosen sides engine (#657 "tighter") on the member's ratings without the title, and again with
// the title at the new score, and says what changed:
//
// - joins:   the title lands in a side that was already there (its share before and after, and its rank by size);
// - new:     the title lands in a side that wasn't there before (the sides reshaped around it);
// - forming: the title fits no side well, but it and at least two other loved titles that fit no side well are alike;
// - loose:   the title fits no side, and nothing forms (left out quietly);
// - middle:  a score that isn't "loved" and isn't 5 or less: sides don't change;
// - low:     5 or less (the #526 moment): sides don't change; `inside` is the side it sits closest to, if it is close.
//
// Read-only: nothing is written; the member's real ratings are read as the Taste page reads them.
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { KEYS, cosine, readPerson, type Person, type RatedTitle } from "~/server/taste-portrait/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import { enrich } from "~/server/prototype-better-sides/index.server"
import { buildTighter, type Built } from "~/server/prototype-better-sides/engine.server"
import { protoMembers } from "~/server/prototype-better-sides/members.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import type { Demo, MomentSide, MomentView, Outcome } from "~/ui/prototype-rating-moment/model"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"

const HUES = ["#f59e0b", "#38bdf8", "#f472b6", "#34d399", "#a78bfa", "#fb923c"]
// Production's membership rule (main, #666): a loved title belongs to a side only when it is at least 0.3 close to
// the side's center and not far below the catalog (z -1) on an attribute the side's name claims; the rest fit no side.
const FITS = 0.3
const AGAINST_NAME = -1
/** A forming group is news only when it is this close to holding as a side. */
const FORMING_NEEDS = 3
/** Two misfits this alike or more could hold together as a side. */
const ALIKE = 0.5
/** A low score this close to a side's center sits "inside" that side. */
const INSIDE = 0.35

interface State {
	person: Person
	built: Built
	loved: RatedTitle[]
	/** The engine's sides with production's membership rule applied; `at` is the side's index in `built`. */
	kept: { at: number; members: TitleKey[] }[]
	/** Loved titles on a side. */
	onSide: Set<TitleKey>
}

/** Whether a title belongs to the engine's side `i` by production's rule. */
function belongs(built: Built, i: number, z: ArrayLike<number>) {
	if (cosine(z, built.centers[i]) < FITS) return false
	return (built.sides[i].nameKeys ?? []).every((key) => z[KEYS.indexOf(key)] >= AGAINST_NAME)
}

function keep(person: Person, built: Built) {
	const kept = built.sides
		.map((_, i) => ({ at: i, members: built.memberKeys[i].filter((k) => belongs(built, i, person.zOf(k) ?? [])) }))
		.filter((s) => s.members.length >= 2)
		.sort((a, b) => b.members.length - a.members.length)
	return { kept, onSide: new Set(kept.flatMap((s) => s.members)) }
}

const kept = new Map<string, { at: number; value: Promise<State> }>()
function stateOf(cacheKey: string, make: () => Person): Promise<State> {
	const hit = kept.get(cacheKey)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value
	const value = Promise.resolve().then(() => {
		const person = make()
		const built = buildTighter(person)
		return { person, built, loved: lovedTitles(person), ...keep(person, built) }
	})
	kept.set(cacheKey, { at: Date.now(), value })
	value.catch(() => kept.delete(cacheKey))
	return value
}

const withScores = (person: Person, scores: Map<TitleKey, number>) =>
	readPerson(person.snapshot, { ...person.input, scores: scores as never })

export type Placement = "nearest" | "rebuild"

export async function momentView(request: Request, slot: string | null, key: TitleKey, score: number | null, placement: Placement = "nearest"): Promise<MomentView | null> {
	const startedAt = performance.now()
	const members = await protoMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
	const member = list.find((m) => m.slot === slot) ?? list[0]
	const proto = await protoPerson(member.userId)
	if (!proto) return null
	const now = proto.person
	const mine = (now.input.scores.get(key) as number | undefined) ?? null

	// Before: the member's ratings without this title, as if rating it for the first time.
	const without = new Map(now.input.scores as Map<TitleKey, number>)
	without.delete(key)
	// nearest: the member's sides as they are today, with this title taken out of its side (no rebuild). rebuild: the
	// sides built from the ratings without it.
	const current = await stateOf(`${member.userId}:now`, () => now)
	const before = placement === "nearest" || mine === null ? current : await stateOf(`${member.userId}:${key}:-`, () => withScores(now, without))
	const lovedFrom = Math.max(8, Math.round(before.person.mu + 0.6 * before.person.sigma))
	const wasLoved = placement === "nearest" && before.loved.some((r) => r.key === key)
	const lovedBefore = before.loved.length - (wasLoved ? 1 : 0)
	const beforeSides = sidesOf(before, null).map((s) => {
		if (placement !== "nearest" || !s.members.includes(key)) return s
		const count = s.count - 1
		return { ...s, count, members: s.members.filter((k) => k !== key), here: s.here.filter((k) => k !== key) }
	})
	if (wasLoved) for (const s of beforeSides) s.share = Math.round((s.count / Math.max(1, lovedBefore)) * 1000) / 1000
	// rebuild: the sides built again with the new score (what a full rebuild would show). nearest: the sides stay, and
	// the title joins the nearest one (what the moment can say without regrouping everything).
	const after =
		score === null || placement === "nearest"
			? null
			: await stateOf(`${member.userId}:${key}:${score}`, () => withScores(now, new Map([...without, [key, score]])))
	let afterSides: MomentSide[] | null = null
	let outcome: Outcome = { kind: "none" }
	// What the moment says instead when a forming group isn't close to holding.
	let fallback: Outcome | null = null
	if (score !== null && placement === "nearest") {
		const placed = placeNearest(before, beforeSides, key, score, lovedFrom, lovedBefore)
		afterSides = placed.sides
		outcome = placed.outcome
		if (outcome.kind === "forming") {
			const plain = placeNearest(before, beforeSides, key, score, lovedFrom, lovedBefore, false)
			fallback = plain.outcome
			if (plain.outcome.kind === "joins") afterSides = plain.sides
		}
	} else if (after) {
		afterSides = sidesOf(after, beforeSides)
		outcome = outcomeOf(before, after, beforeSides, afterSides, key, score as number)
	}

	// Unseen titles from the side it joined, in the member's personal order (sides group, personal order ranks).
	const joinedId = outcome.kind === "joins" || outcome.kind === "new" ? outcome.side : null
	const joined = joinedId ? (after ?? before).built.sides.find((s) => s.id === joinedId) : null
	const more = joined ? proto.order(joined.moreOfThis.filter((k) => k !== key)).slice(0, 6) : []

	// Demo titles come from the member's whole state (with their real ratings).
	const { demos, formingCandidates } = demosOf(current, proto.order)

	const keys = new Set<TitleKey>([key, ...more, ...demos.map((d) => d.key)])
	for (const s of [...beforeSides, ...(afterSides ?? [])]) for (const k of s.here) keys.add(k)
	if (outcome.kind === "forming") for (const k of outcome.with.slice(0, 12)) keys.add(k)
	for (const c of formingCandidates) for (const k of [c.key, ...c.with.slice(0, 8)]) keys.add(k)
	const titles = await enrich(now, keys)

	// A forming side made of one franchise isn't a side ("Die Hard" three times): keep one title per franchise, and
	// without two others from other franchises, nothing forms.
	if (outcome.kind === "forming") {
		const own = franchise(titles[key]?.title)
		const seen = new Set([own])
		const others = outcome.with.filter((k) => {
			const f = franchise(titles[k]?.title)
			if (seen.has(f)) return false
			seen.add(f)
			return true
		})
		const needs = Math.max(0, outcome.needs + outcome.with.length - others.length)
		// Far from holding ("26 more like them") isn't news: the title joins its nearest side, or stays out quietly.
		if (others.length < 2 || needs > FORMING_NEEDS) outcome = fallback ?? { kind: "loose" }
		else outcome = { ...outcome, with: others, size: others.length + 1, needs }
	}

	// The forming demo: the first candidate whose alike titles span two other franchises.
	const minSize = Math.max(3, Math.ceil(0.07 * current.loved.length))
	const formingDemo = formingCandidates.find((c) => {
		const seen = new Set([franchise(titles[c.key]?.title)])
		for (const k of c.with) seen.add(franchise(titles[k]?.title))
		return seen.size >= 3 && minSize - seen.size <= FORMING_NEEDS
	})
	if (formingDemo && !demos.some((d) => d.key === formingDemo.key))
		demos.splice(Math.min(demos.length, current.built.sides.length), 0, {
			key: formingDemo.key,
			label: "Loved, may start a side",
			mine: (now.input.scores.get(formingDemo.key) as number | undefined) ?? null,
		})

	return {
		member: { slot: member.slot, label: member.label },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		key,
		mine,
		score,
		lovedFrom,
		placement,
		before: { sides: beforeSides, loose: lovedBefore - beforeSides.reduce((n, s) => n + s.count, 0), loved: lovedBefore },
		after: !afterSides
			? null
			: after
				? { sides: afterSides, loose: after.loved.length - after.onSide.size, loved: after.loved.length }
				: {
						sides: afterSides,
						loose: lovedBefore - beforeSides.reduce((n, s) => n + s.count, 0) + (outcome.kind === "loose" || outcome.kind === "forming" ? 1 : 0),
						loved: lovedBefore + (outcome.kind === "middle" || outcome.kind === "low" ? 0 : 1),
					},
		outcome,
		more,
		demos,
		titles,
		personalOrder: proto.personalOrder,
		computedMs: Math.round(performance.now() - startedAt),
	}
}

/** The client's sides, hues carried over from the matching side before (by shared loved titles). */
function sidesOf(state: State, previous: MomentSide[] | null): MomentSide[] {
	const { built, loved } = state
	const used = new Set<string>()
	const sides = state.kept.map(({ at, members }) => {
		const side = built.sides[at]
		let matched: MomentSide | null = null
		if (previous) {
			let best = 0
			for (const p of previous) {
				if (used.has(p.id)) continue
				const shared = members.filter((k) => p.members.includes(k)).length
				const overlap = shared / Math.max(1, Math.min(members.length, p.members.length))
				if (overlap > best && overlap >= 0.5) {
					best = overlap
					matched = p
				}
			}
			if (matched) used.add(matched.id)
		}
		return {
			id: side.id,
			name: side.name,
			share: Math.round((members.length / Math.max(1, loved.length)) * 1000) / 1000,
			count: members.length,
			here: side.here.filter((k) => members.includes(k)).slice(0, 5),
			at,
			members,
			moods: sideMoods(members, loved, state.person),
			hue: matched?.hue ?? "",
			was: matched?.id ?? null,
		}
	})
	const free = HUES.filter((h) => !sides.some((s) => s.hue === h))
	for (const [i, s] of sides.entries()) if (!s.hue) s.hue = previous ? (free.shift() ?? HUES[0]) : HUES[i % HUES.length]
	return sides
}

/** Up to two moods the side's titles have much more often than the member's loved titles overall. */
function sideMoods(members: TitleKey[], loved: RatedTitle[], person: Person): MoodKey[] {
	const count = (keys: TitleKey[]) => {
		const c = new Map<MoodKey, number>()
		for (const k of keys) for (const m of person.ratedByKey.get(k)?.facts.moods ?? []) c.set(m, (c.get(m) ?? 0) + 1)
		return c
	}
	const inSide = count(members)
	const overall = count(loved.map((r) => r.key))
	return [...inSide.entries()]
		.map(([m, n]) => ({ m, share: n / members.length, lift: n / members.length - (overall.get(m) ?? 0) / Math.max(1, loved.length) }))
		.filter((x) => x.share >= 0.3 && x.lift > 0 && MOOD_BY_KEY[x.m])
		.sort((a, b) => b.lift - a.lift)
		.slice(0, 2)
		.map((x) => x.m)
}

/** For a low score: the side it sits closest to, when it is close (no claim that it belongs). */
function insideOf(state: State, sides: MomentSide[], z: ArrayLike<number> | null) {
	let inside: string | null = null
	let best = INSIDE
	if (z)
		for (const s of sides) {
			const sim = cosine(z, state.built.centers[s.at])
			if (sim >= best) {
				best = sim
				inside = s.id
			}
		}
	return inside
}

function onAnySide(state: State, z: ArrayLike<number>) {
	return state.kept.some((s) => belongs(state.built, s.at, z))
}

/** Loved titles that fit no side and are alike enough to the title to hold together with it. */
function formingWith(state: State, key: TitleKey) {
	const z = state.person.zOf(key)
	if (!z || onAnySide(state, z)) return []
	return state.loved
		.filter((r) => r.key !== key && !state.onSide.has(r.key))
		.map((r) => ({ key: r.key, alike: cosine(r.z, z) }))
		.filter((r) => r.alike >= ALIKE)
		.sort((a, b) => b.alike - a.alike)
		.map((r) => r.key)
}

function outcomeOf(before: State, after: State, beforeSides: MomentSide[], afterSides: MomentSide[], key: TitleKey, score: number): Outcome {
	if (score <= 5) return { kind: "low", inside: insideOf(before, beforeSides, before.person.zOf(key)) }
	if (!after.loved.some((r) => r.key === key)) return { kind: "middle" }
	const minSize = Math.max(3, Math.ceil(0.07 * after.loved.length))
	const at = afterSides.findIndex((s) => s.members.includes(key))
	if (at < 0) {
		const forming = formingWith(after, key)
		if (forming.length >= 2) return { kind: "forming", with: forming, size: forming.length + 1, needs: Math.max(0, minSize - forming.length - 1) }
		return { kind: "loose" }
	}
	const side = afterSides[at]
	const was = side.was ? beforeSides.findIndex((s) => s.id === side.was) : -1
	if (was < 0) return { kind: "new", side: side.id, sidesBefore: beforeSides.length, sidesAfter: afterSides.length }
	return {
		kind: "joins",
		side: side.id,
		was: beforeSides[was].id,
		shareBefore: beforeSides[was].share,
		shareAfter: side.share,
		countBefore: beforeSides[was].count,
		countAfter: side.count,
		rankBefore: was,
		rankAfter: at,
		// One title more but the side didn't grow: the sides regrouped around it.
		reshaped: beforeSides.length !== afterSides.length || side.count <= beforeSides[was].count,
	}
}

/** The sides stay as they are; a loved title joins the closest side it belongs to by production's rule, or none. */
function placeNearest(before: State, sides: MomentSide[], key: TitleKey, score: number, lovedFrom: number, lovedBefore: number, mayForm = true): { sides: MomentSide[]; outcome: Outcome } {
	const z = before.person.zOf(key)
	const same = sides.map((s) => ({ ...s, was: s.id }))
	if (score <= 5) return { sides: same, outcome: { kind: "low", inside: insideOf(before, sides, z) } }
	if (score < lovedFrom || !z) return { sides: same, outcome: { kind: "middle" } }
	const loved = lovedBefore + 1
	const sims = sides.map((s) => (belongs(before.built, s.at, z) ? cosine(z, before.built.centers[s.at]) : Number.NEGATIVE_INFINITY))
	const at = sims.indexOf(Math.max(...sims))
	const minSize = Math.max(3, Math.ceil(0.07 * loved))
	const fitsNone = !Number.isFinite(sims[at] ?? Number.NEGATIVE_INFINITY)
	const forming = mayForm && fitsNone ? formingWith(before, key) : []
	const reshare = (joinedAt: number) =>
		sides.map((s, i) => {
			const count = s.count + (i === joinedAt ? 1 : 0)
			return { ...s, was: s.id, count, share: Math.round((count / loved) * 1000) / 1000, members: i === joinedAt ? [...s.members, key] : s.members }
		})
	if (forming.length >= 2) return { sides: reshare(-1), outcome: { kind: "forming", with: forming, size: forming.length + 1, needs: Math.max(0, minSize - forming.length - 1) } }
	if (fitsNone) return { sides: reshare(-1), outcome: { kind: "loose" } }
	const after = reshare(at)
	// By size; a tie keeps the order before the rating, so a side moves up only by passing another.
	const rank = (list: MomentSide[], id: string) =>
		list
			.map((s, i) => ({ s, i }))
			.sort((a, b) => b.s.count - a.s.count || a.i - b.i)
			.findIndex((x) => x.s.id === id)
	const id = sides[at].id
	return {
		sides: after,
		outcome: {
			kind: "joins",
			side: id,
			was: id,
			shareBefore: sides[at].share,
			shareAfter: after[at].share,
			countBefore: sides[at].count,
			countAfter: after[at].count,
			rankBefore: rank(sides, id),
			rankAfter: rank(after, id),
			reshaped: false,
		},
	}
}

/** Titles to try the moment with, from the member's own ratings (and one they haven't rated). */
function demosOf(state: State, order: (keys: TitleKey[]) => TitleKey[]): { demos: Demo[]; formingCandidates: { key: TitleKey; with: TitleKey[] }[] } {
	const { person, built, loved } = state
	const demos: Demo[] = []
	const taken = new Set<TitleKey>()
	const push = (key: TitleKey | undefined, label: string) => {
		if (key === undefined || taken.has(key)) return
		taken.add(key)
		demos.push({ key, label, mine: (person.input.scores.get(key) as number | undefined) ?? null })
	}
	state.kept.forEach((side, i) => {
		const here = built.sides[side.at].here.filter((k) => side.members.includes(k))
		push(here[1] ?? here[0], `Loved, in side ${i + 1}`)
	})
	const misfits = loved.filter((r) => !state.onSide.has(r.key))
	const formingCandidates = misfits
		.map((r) => ({ key: r.key, with: misfits.filter((o) => o !== r && cosine(o.z, r.z) >= ALIKE).map((o) => o.key) }))
		.filter((x) => x.with.length >= 2)
		.sort((a, b) => b.with.length - a.with.length)
		.slice(0, 8)
	push(misfits.find((r) => !formingCandidates.some((c) => c.key === r.key))?.key ?? misfits[0]?.key, "Loved, fits no side")
	const closest = (z: ArrayLike<number>) => Math.max(-1, ...state.kept.map((k) => cosine(z, built.centers[k.at])))
	const low = person.rated
		.filter((r) => r.score <= 5)
		.map((r) => ({ r, fit: closest(r.z) }))
		.sort((a, b) => b.fit - a.fit)[0]
	push(low?.r.key, "Rated 5 or less")
	const cut = Math.max(8, Math.round(person.mu + 0.6 * person.sigma))
	push(person.rated.find((r) => r.score >= 6 && r.score < cut)?.key, "Liked, not loved")
	push(order(built.sides[state.kept[0]?.at ?? 0]?.moreOfThis ?? [])[0], "Not rated yet")
	for (const c of formingCandidates) taken.add(c.key)
	return { demos, formingCandidates: formingCandidates.filter((c) => !demos.some((d) => d.key === c.key)) }
}

/** "die hard" for "Die Hard: With a Vengeance" and "Die Hard 2". */
function franchise(title: string | undefined) {
	return (title ?? "")
		.toLowerCase()
		.replace(/^(the|a|an) /, "")
		.split(/:| part | \d| - /)[0]
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.join(" ")
}
