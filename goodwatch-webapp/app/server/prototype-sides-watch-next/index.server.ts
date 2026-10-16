// PROTOTYPE - throwaway (#659, map #652). One member's real Watch next with the groups of titles they love (production's
// Sides of you), read-only: nothing is written (no list exposure, no plan store). The Wishlist is planned as
// production plans it (fit, time, Not tonight), ordered by the member's personal order as production orders it
// (franchise groups, then the fitting mix), and every title is judged by production's rule for loved titles (#666):
// its nearest group, at least 0.3 close, and not far below the catalog on an attribute the group's name claims; others
// fit no group. Groups are production's sides (a copy of origin/main's taste-portrait/sides.server.ts in
// production-sides.server.ts). Picked groups narrow like a mood; personal order ranks: a group never moves a title
// ahead of another.
import { MAX_MOODS, MOOD_KEYS, type MoodKey, maskOfMoods } from "~/domain/moods"
import type { WatchNextTierKey, WatchNextTierSize } from "~/domain/watch-next"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import { loadPersonalOrder, mixPersonalOrderFitting, orderPersonalOrder } from "~/server/personal-order/reader.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { loadTaste } from "~/server/taste/index.server"
import { MAX_KEYS, getDisplayFields, getServiceCards, getTitleCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { membersNote, swnMembers } from "./members.server"
import { buildSides, sideOfTitle } from "./production-sides.server"
import {
	type Plan,
	type WatchNext,
	type WatchNextTitle,
	pictureKeys,
	planWatchNext,
	sortFactsOutsideSnapshot,
	wishlistTitle,
} from "~/server/watch-next.server"
import { groupWords, likeInline } from "~/ui/prototype-sides-watch-next/label"
import { RULE, type SwnGroup, type SwnTier, type SwnView, type VariantKey } from "~/ui/prototype-sides-watch-next/model"
import { TIER_LABEL, TIER_NOTE } from "~/ui/watch-next/labels"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"

const THEN = 3
const CARDED = 600

export interface SwnOptions {
	variant: VariantKey
	slot: string | null
	list: "movies" | "all"
	moods: MoodKey[]
	onMyServices: boolean
	time: number | null
	/** The picked groups, by id (g1, g2, ...). */
	groups: string[]
	passed: TitleKey[]
}

export async function swnView(request: Request, o: SwnOptions): Promise<SwnView | null> {
	const startedAt = performance.now()
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const members = await swnMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
	const member = list.find((m) => m.slot === o.slot) ?? list[0]
	const [proto, ctx, taste] = await Promise.all([
		protoPerson(member.userId),
		getMemberViewerContext(member.userId, "US"),
		loadTaste({ kind: "member", userId: member.userId }),
	])
	if (!proto) return null
	const { person } = proto
	const movies = o.list === "movies"
	const options = {
		sort: "match" as const,
		moods: o.moods,
		onMyServices: o.onMyServices,
		notTonight: o.passed,
		...(movies ? { kind: "movie" as const, time: o.time } : {}),
	}
	const [outside, runtimes] = await Promise.all([
		sortFactsOutsideSnapshot(ctx.wishlist.keys()),
		movies && o.time ? movieRuntimes(ctx.wishlist.keys()) : undefined,
	])
	// Production's plan without personal order: its entries (fit, time) and today's order.
	const plan = planWatchNext(ctx, taste, options, outside, runtimes)
	const todayOrder = [...plan.head.map((e) => e.key), ...plan.tiers.flatMap((t) => t.keys)]
	const notes: string[] = []

	// ---- groups ----
	const built = buildSides(person)
	const idOf = new Map(built.sides.map((side, i) => [side.id, `g${i + 1}`]))
	const groupOf = new Map<TitleKey, string | null>()
	for (const key of plan.entries.keys()) {
		const z = person.zOf(key)
		const side = z ? sideOfTitle(z, built.protoGroups) : null
		groupOf.set(key, side ? (idOf.get(side) ?? null) : null)
	}
	const rule = RULE[o.variant]
	const known = o.groups.filter((g) => [...idOf.values()].includes(g))
	const picked = rule === "any" ? known.slice(0, Math.max(0, MAX_MOODS - plan.moods.length)) : rule === "also" ? known.slice(0, 1) : []
	const inPicked = (key: TitleKey) => picked.includes(groupOf.get(key) ?? "")

	// ---- fit: production's, with the picked groups among the moods ("any") or as one more condition ("also") ----
	const passed = new Set(o.passed)
	const moodMask = maskOfMoods(plan.moods)
	const moodCondition = plan.moods.length > 0 || (rule === "any" && picked.length > 0)
	const onServices = (e: { onServices: boolean | null }) => (plan.onMyServices && e.onServices !== false ? 1 : 0)
	const need =
		rule === "any" && picked.length ? (moodCondition ? 1 : 0) + (plan.onMyServices ? 1 : 0) : plan.need + (rule === "also" && picked.length ? 1 : 0)
	const entries = [...plan.entries.values()].map((e) => {
		if (!picked.length) return { ...e }
		if (rule === "also") return { ...e, fit: e.fit + (inPicked(e.key) ? 1 : 0) }
		const hit = (plan.moods.length > 0 && (e.moodMask & moodMask) !== 0) || inPicked(e.key)
		return { ...e, fit: (hit ? 1 : 0) + onServices(e) }
	})
	const byKey = new Map(entries.map((e) => [e.key, e]))
	const tiered = (a: (typeof entries)[number], b: (typeof entries)[number]) =>
		Math.sign(a.over) - Math.sign(b.over) || b.fit - a.fit || a.over - b.over || Number(passed.has(a.key)) - Number(passed.has(b.key))
	const read = await loadPersonalOrder(member.userId, snapshot).catch(() => ({ data: null, fallbackReason: "error" }))
	const data = read.data && read.data.payload.snapshotVersion === snapshot.version ? read.data : null
	let ranked: typeof entries
	if (data) {
		const groups = orderPersonalOrder(entries.map((e) => e.key), data, snapshot, false)
		ranked = groups.keys.map((k) => byKey.get(k)!).sort(tiered)
		const fittingKeys = ranked.filter((e) => e.fit === need && !e.over && !passed.has(e.key)).map((e) => e.key)
		const mix = mixPersonalOrderFitting(fittingKeys, data, snapshot, groups.ranks)
		const replace = new Set(fittingKeys)
		let i = 0
		ranked = ranked.map((e) => (replace.has(e.key) ? byKey.get(mix.keys[i++])! : e))
	} else {
		const at = new Map(todayOrder.map((k, i) => [k, i]))
		ranked = [...entries].sort((a, b) => (at.get(a.key) ?? 1e9) - (at.get(b.key) ?? 1e9)).sort(tiered)
		notes.push(`Personal order not loaded (${read.data ? "snapshot-mismatch" : (read.fallbackReason ?? "none")}): today's Best match order instead`)
	}

	// ---- head and tiers, as production cuts them; with a group as its own condition, what fits all else follows ----
	const fitsAll = (e: (typeof entries)[number]) => e.fit === need && !e.over
	const fitting = ranked.filter(fitsAll)
	// Nothing fits: the closest titles lead, as production's hero does.
	const head = (fitting.length || !ranked.length ? fitting : ranked).slice(0, 1 + THEN)
	const inHead = new Set(head.map((e) => e.key))
	const rest = ranked.filter((e) => !inHead.has(e.key))
	const elseFits = rule === "also" && picked.length ? rest.filter((e) => !inPicked(e.key) && e.fit === need - 1 && !e.over) : []
	const isElse = new Set(elseFits.map((e) => e.key))
	const later = rest.filter((e) => !isElse.has(e.key))
	const groupWordsOf = new Map<string, ReturnType<typeof groupWords>>()
	const tier = (key: SwnTier["key"], size: WatchNextTierSize, l: typeof entries): SwnTier => ({
		key,
		size,
		label: key === "elseFits" ? "Fits everything else" : TIER_LABEL[key as WatchNextTierKey],
		note:
			key === "elseFits"
				? picked.length
					? `They fit tonight, but aren't ${likeInline(groupWordsOf.get(picked[0])!)}.`
					: null
				: (TIER_NOTE[key as WatchNextTierKey] ?? null),
		keys: l.map((e) => e.key),
	})
	const fits = later.filter(fitsAll)
	let tiers: SwnTier[]
	const faceKeys = [...new Set(built.sides.flatMap((s) => [...s.here.slice(0, 2), ...(s.image ? [s.image] : [])]))]
	const faceDisplays = await getDisplayFields(faceKeys.slice(0, MAX_KEYS))
	built.sides.forEach((side) => {
		groupWordsOf.set(idOf.get(side.id)!, groupWords(side.here.slice(0, 2).map((k) => faceDisplays.get(k)?.title ?? "?")))
	})
	const otherTier = tier("elseFits", "md", elseFits)
	if (movies)
		tiers = [tier("upNext", "xl", fits.slice(0, 4)), tier("soon", "lg", fits.slice(4, 16)), tier("later", "md", fits.slice(16)), otherTier, tier("notTonightsFit", "md", later.filter((e) => !fitsAll(e)))]
	else if (!need)
		tiers = [tier("upNext", "xl", later.slice(0, 4)), tier("soon", "lg", later.slice(4, 12)), tier("later", "md", later.slice(12, 32)), tier("someday", "sm", later.slice(32))]
	else {
		const closeKey: WatchNextTierKey = moodCondition && plan.onMyServices ? "close" : moodCondition ? "otherMoods" : "elsewhere"
		const close = later.filter((e) => e.fit === need - 1)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			otherTier,
			...(close.length ? [tier(need > (rule === "also" && picked.length ? 1 : 0) ? closeKey : "notTonight", "md", close)] : []),
			tier("notTonight", "sm", later.filter((e) => e.fit < need - 1)),
		]
	}
	tiers = tiers.filter((t) => t.keys.length)

	// ---- cards ----
	const shownKeys = [...head.map((e) => e.key), ...tiers.flatMap((t) => t.keys)].slice(0, CARDED)
	const chunks: TitleKey[][] = []
	for (let i = 0; i < shownKeys.length; i += MAX_KEYS) chunks.push(shownKeys.slice(i, i + MAX_KEYS))
	const planForCards = { ...plan, need, entries: new Map(entries.map((e) => [e.key, e])) } as Plan
	const pictures = pictureKeys(plan, snapshot)
	const [cards, backdrops, myServices] = await Promise.all([
		Promise.all(chunks.map((chunk) => getTitleCards(chunk, ctx, taste))).then((c) => c.flat()),
		getDisplayFields(Object.values(pictures)),
		getServiceCards(ctx.services),
	])
	const titles: Record<string, WatchNextTitle> = {}
	for (const card of cards) titles[card.key] = wishlistTitle(planForCards, card)

	// ---- the groups, counted as the moods are ----
	const counted = entries.filter((e) => !plan.onMyServices || e.onServices !== false)
	const groups: SwnGroup[] = built.sides.map((side) => {
		const id = idOf.get(side.id)!
		const art = [side.image, ...side.here].find((k) => k && faceDisplays.get(k)?.backdrop_path)
		return {
			id,
			words: groupWordsOf.get(id)!,
			faces: side.here.slice(0, 2),
			backdrop: art ? (faceDisplays.get(art)?.backdrop_path ?? null) : null,
			count: counted.filter((e) => groupOf.get(e.key) === id).length,
		}
	})
	const none = [...groupOf.values()].filter((g) => g === null).length
	notes.push(membersNote, `Production's sides (#666 rule): ${groups.length} groups`, `${none} of ${groupOf.size} listed titles fit no group`)

	// ---- what production's hero, Then column, and strip read ----
	const headTitles = head.flatMap((e) => (titles[e.key] ? [titles[e.key]] : []))
	const watchNext: WatchNext = {
		planId: null,
		listId: null,
		sort: plan.sort,
		defaultSort: plan.defaultSort,
		moods: plan.moods,
		onMyServices: plan.onMyServices,
		hasServices: plan.hasServices,
		myServices,
		servicesPending: plan.servicesPending,
		bestMatch: plan.bestMatch,
		total: plan.total,
		fitting: fitting.length,
		hero: headTitles[0] ?? null,
		heroNote: fitting.length ? null : moodCondition && !plan.moods.length ? "closestToMoods" : plan.heroNote,
		thenColumn: headTitles.slice(1),
		tiers: [],
		moodCounts: plan.moodCounts,
		moodPictures: Object.fromEntries(
			MOOD_KEYS.map((mood) => {
				const key = pictures[mood]
				const backdropPath = key === undefined ? null : backdrops.get(key)?.backdrop_path
				return [mood, key !== undefined && backdropPath ? { key, backdropPath } : null]
			}),
		) as WatchNext["moodPictures"],
		start: null,
		worthAdding: [],
		...(movies ? { time: plan.time } : {}),
	}
	return {
		variant: o.variant,
		rule,
		list: o.list,
		member: { slot: member.slot, label: member.label, ratings: member.ratings || person.rated.length, listed: plan.total },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		data: watchNext,
		tiers,
		fitting: fitting.map((e) => e.key),
		titles,
		groups,
		groupOf: Object.fromEntries(groupOf),
		picked,
		passed: o.passed,
		personalOrder: { on: data !== null, note: data ? null : (read.fallbackReason ?? "snapshot-mismatch") },
		notes,
		computedMs: Math.round(performance.now() - startedAt),
	}
}
