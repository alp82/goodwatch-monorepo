// PROTOTYPE - throwaway (#662). "Something new may be taking shape in your taste": a loved title that fits none of
// the member's taste groups, but goes with at least two other loved titles that fit none either, close enough to a
// taste group's size that a few more would make one. The rules are production's (sides.server.ts): the same loved
// titles, the same groups, the same "fits no group" rule; a forming set counts one title per franchise.
//
// Read-only. Members are picked at runtime (`?as=m1`..`m5`), and no member ids are kept in files.
import { getMemberViewerContext } from "~/server/viewer.server"
import { portraitInput } from "~/server/taste-portrait/index.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { cosine, readPerson, type Person, type RatedTitle } from "~/server/taste-portrait/person.server"
import { franchiseOf, lovedTitles, namedSides, type NamedSides } from "~/server/taste-portrait/sides.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { loadTaste } from "~/server/taste/index.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"

/** Two loved titles on no group this alike or more could hold together as a group (the groups' own bar is 0.55). */
const ALIKE = 0.5
/** A forming set is worth a word only when this few more titles would make it a group. */
const NEEDS = 3

export interface FormingTitle {
	key: TitleKey
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	poster: string | null
}

export interface Forming {
	/** The title that was rated, first; then the loved titles on no group it goes with, closest first. */
	titles: FormingTitle[]
	/** How many more loved titles like these make a group. */
	needs: number
}

export interface HintView {
	member: string
	ratings: number
	groups: number
	/** After rating the title (when asked with a title and a score): what forms with it, or null. */
	after: Forming | null
	/** For the Taste page: what is forming in the member's taste now. */
	now: Forming[]
	/** Titles that show the hint when rated 8 or more: real titles from this member's forming sets, taken out first. */
	demos: FormingTitle[]
}

const maxK = (n: number) => Math.min(5, n < 50 ? Math.min(3, Math.floor(n / 2.5)) : n < 120 ? 4 : 5)
const minSize = (n: number) => (n < 30 ? 2 : Math.max(3, Math.ceil(0.07 * n)))

interface State {
	person: Person
	named: NamedSides | null
	loved: RatedTitle[]
	on: Set<TitleKey>
}

function stateOf(person: Person): State {
	const named = namedSides(person)
	const on = new Set<TitleKey>()
	for (const side of named?.sides ?? []) for (const m of side.members) on.add(m.key)
	return { person, named, loved: lovedTitles(person), on }
}

/** Loved titles on no group alike to `t`, closest first, one per franchise (and not the title's own). */
function alikeOf(state: State, t: { key: TitleKey; z: ArrayLike<number> }, names: Map<TitleKey, string>) {
	const own = franchiseOf(names.get(t.key) ?? "")
	const seen = new Set([own])
	const out: RatedTitle[] = []
	for (const r of state.loved
		.filter((r) => r.key !== t.key && !state.on.has(r.key) && cosine(r.z, t.z) >= ALIKE)
		.sort((a, b) => cosine(b.z, t.z) - cosine(a.z, t.z) || a.key - b.key)) {
		const f = franchiseOf(names.get(r.key) ?? String(r.key))
		if (seen.has(f)) continue
		seen.add(f)
		out.push(r)
	}
	return out
}

/** What forms with `key` in this state: null unless it is loved, on no group, and alike to 2+ others close to a group's size. */
function formingWith(state: State, key: TitleKey, names: Map<TitleKey, string>): { keys: TitleKey[]; needs: number } | null {
	const t = state.loved.find((r) => r.key === key)
	if (!t || !state.named || state.on.has(key)) return null
	// Already as many groups as the member's loved titles allow: nothing new can start.
	if (state.named.sides.length >= maxK(state.loved.length)) return null
	const alike = alikeOf(state, t, names)
	if (alike.length < 2) return null
	const needs = Math.max(0, minSize(state.loved.length) - alike.length - 1)
	if (needs > NEEDS) return null
	return { keys: [key, ...alike.map((r) => r.key)], needs }
}

// ---------- members ----------

const TARGETS = [1000, 450, 300, 120, 55]
let picked: { at: number; members: { slot: string; userId: string; ratings: number }[] } | null = null

async function members() {
	if (picked && Date.now() - picked.at < 30 * 60_000) return picked.members
	const rows = await query<{ user_id: string; n: number }>(
		"SELECT user_id, count(*) AS n FROM user_score WHERE score > 0 GROUP BY user_id ORDER BY n DESC LIMIT 400",
		[],
		{ timeoutMs: 60_000 },
	)
	const used = new Set<string>()
	const list = TARGETS.map((target, i) => {
		const row = rows.filter((r) => !used.has(r.user_id)).sort((a, b) => Math.abs(a.n - target) - Math.abs(b.n - target))[0]
		used.add(row.user_id)
		return { slot: `m${i + 1}`, userId: row.user_id, ratings: Number(row.n) }
	})
	picked = { at: Date.now(), members: list }
	return list
}

const cache = new Map<string, { at: number; value: unknown }>()
async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
	const hit = cache.get(key)
	if (hit && Date.now() - hit.at < 60 * 60_000) return hit.value as T
	const value = await make()
	cache.set(key, { at: Date.now(), value })
	return value
}

async function memberInput(request: Request, as: string | null) {
	const list = await members()
	const chosen = as ? list.find((m) => m.slot === as) : null
	const userId = chosen?.userId ?? (await getUserIdFromRequest({ request }))
	if (!userId) return null
	return cached(`input:${userId}`, async () => {
		const ctx = await getMemberViewerContext(userId, "US")
		const taste = await loadTaste({ kind: "member", userId })
		return { label: chosen ? `Member ${chosen.slot.slice(1)}` : "You", input: portraitInput("member", ctx, taste) }
	})
}

async function displays(keys: TitleKey[]) {
	const shown = await titleDisplays(new Set(keys))
	return keys.flatMap((key): FormingTitle[] => {
		const d = shown.get(key)
		if (!d) return []
		const { mediaType, tmdbId } = parseTitleKey(key)
		return [{ key, mediaType, tmdbId, title: d.title, poster: d.poster }]
	})
}

/** The hint for a member, as the Taste page would see it now, and after rating `key` with `score`. */
export async function formingHint(request: Request): Promise<HintView | null> {
	const url = new URL(request.url)
	const as = url.searchParams.get("as")
	const key = Number(url.searchParams.get("key")) || null
	const score = Number(url.searchParams.get("score")) || null
	const snapshot = getTitleSnapshot()
	const who = await memberInput(request, as)
	if (!snapshot || !who) return null
	const { input } = who
	const base = await cached(`base:${as}`, async () => {
		const state = stateOf(readPerson(snapshot, input))
		const names = new Map((await displays(state.loved.map((r) => r.key))).map((t) => [t.key, t.title]))
		// What is forming now: each loved title on no group that forms, sets that share titles counted once.
		const now: { keys: TitleKey[]; needs: number }[] = []
		const used = new Set<TitleKey>()
		for (const r of state.loved) {
			if (used.has(r.key)) continue
			const f = formingWith({ ...state, on: new Set([...state.on, ...used]) }, r.key, names)
			if (!f) continue
			now.push(f)
			for (const k of f.keys) used.add(k)
		}
		// Demos: a title of a forming set, taken out of the member's ratings, that forms again when rated back.
		const demos: TitleKey[] = []
		for (const f of now) {
			for (const k of f.keys) {
				const without = new Map(input.scores)
				const mine = without.get(k)
				without.delete(k)
				const before = stateOf(readPerson(snapshot, { ...input, scores: without }))
				if (before.on.has(k)) continue
				const after = stateOf(readPerson(snapshot, { ...input, scores: new Map([...without, [k, mine ?? 9]]) }))
				if (formingWith(after, k, names)) {
					demos.push(k)
					break
				}
			}
		}
		return { state, names, now, demos }
	})
	let after: { keys: TitleKey[]; needs: number } | null = null
	if (key && score) {
		const scores = new Map(input.scores)
		scores.delete(key)
		const before = stateOf(readPerson(snapshot, { ...input, scores }))
		// Already in a group before this rating: nothing forms around it.
		if (!before.on.has(key)) {
			scores.set(key, score)
			const state = stateOf(readPerson(snapshot, { ...input, scores }))
			const names = new Map(base.names)
			for (const t of await displays([key])) names.set(t.key, t.title)
			after = formingWith(state, key, names)
		}
	}
	return {
		member: who.label,
		ratings: input.scores.size,
		groups: base.state.named?.sides.length ?? 0,
		after: after ? { titles: await displays(after.keys.slice(0, 4)), needs: after.needs } : null,
		now: await Promise.all(base.now.map(async (f) => ({ titles: await displays(f.keys.slice(0, 4)), needs: f.needs }))),
		demos: await displays(base.demos),
	}
}

/** The member `?as=` names (m1..m5), for the Taste page in development; null without one. */
export async function protoMemberId(request: Request): Promise<string | null> {
	const as = new URL(request.url).searchParams.get("as")
	if (!as) return null
	return (await members()).find((m) => m.slot === as)?.userId ?? null
}
