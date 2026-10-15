// PROTOTYPE - throwaway (#659, map #652). One member's real Watch next with their Sides of you, read-only: nothing is
// written (no list exposure, no plan store). The Wishlist is planned as production plans it (fit, time, Not tonight),
// ordered by the member's personal order as production orders it (franchise groups, then the fitting mix), and every
// title is given the side whose center it is closest to. Sides are #657's "tighter" sides (even groups of 2 to 5 that
// each hold together). Sides group, personal order ranks: a side never moves a title ahead of another.
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { WatchNextTierKey, WatchNextTierSize } from "~/domain/watch-next"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import { loadPersonalOrder, mixPersonalOrderFitting, orderPersonalOrder } from "~/server/personal-order/reader.server"
import { buildTighter } from "~/server/prototype-better-sides/engine.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { cosine } from "~/server/taste-portrait/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import { loadTaste } from "~/server/taste/index.server"
import { MAX_KEYS, getDisplayFields, getServiceCards, getTitleCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { membersNote, swnMembers } from "./members.server"
import {
	type Plan,
	type WatchNext,
	type WatchNextTitle,
	pictureKeys,
	planWatchNext,
	sortFactsOutsideSnapshot,
	wishlistTitle,
} from "~/server/watch-next.server"
import type { SwnSide, SwnTier, SwnView, VariantKey } from "~/ui/prototype-sides-watch-next/model"
import { TIER_LABEL, TIER_NOTE } from "~/ui/watch-next/labels"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"

// Side colors, apart from the amber the page uses for "fits" and from the mood hues' most used reds and greens.
const COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#a78bfa", "#fb923c"]
// A listed title belongs to its nearest side only this close to the side's center (the loved titles' own cut, #657).
const NEAR = 0.15
const THEN = 3
const CARDED = 600

export interface SwnOptions {
	variant: VariantKey
	slot: string | null
	list: "movies" | "all"
	moods: MoodKey[]
	onMyServices: boolean
	time: number | null
	side: string | null
	passed: TitleKey[]
	names: boolean
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

	// ---- sides ----
	const built = buildTighter(person)
	const sideIds = built.sides.map((s) => s.id)
	const sideOf = new Map<TitleKey, string | null>()
	for (const key of plan.entries.keys()) {
		const z = person.zOf(key)
		let best: { id: string; c: number } | null = null
		if (z)
			built.centers.forEach((center, i) => {
				const c = cosine(z, center)
				if (!best || c > best.c) best = { id: sideIds[i], c }
			})
		const found = best as { id: string; c: number } | null
		sideOf.set(key, found && found.c >= NEAR ? found.id : null)
	}
	const picked = o.variant === "picker" && o.side && sideIds.includes(o.side) ? o.side : null

	// ---- order: personal order as production composes it, with the picked side as one more condition ----
	const passed = new Set(o.passed)
	const need = plan.need + (picked ? 1 : 0)
	const inSide = (key: TitleKey) => !picked || sideOf.get(key) === picked
	const entries = [...plan.entries.values()].map((e) => ({ ...e, fit: e.fit + (picked && inSide(e.key) ? 1 : 0) }))
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

	// ---- head and tiers, as production cuts them, with "From your other sides" for the picker ----
	const fitsAll = (e: (typeof entries)[number]) => e.fit === need && !e.over
	const fitting = ranked.filter(fitsAll)
	const head = (fitting.length || !ranked.length ? fitting : ranked).slice(0, 1 + THEN)
	const inHead = new Set(head.map((e) => e.key))
	const rest = ranked.filter((e) => !inHead.has(e.key))
	const otherSides = picked ? rest.filter((e) => !inSide(e.key) && e.fit === need - 1 && !e.over) : []
	const isOther = new Set(otherSides.map((e) => e.key))
	const later = rest.filter((e) => !isOther.has(e.key))
	const tier = (key: SwnTier["key"], size: WatchNextTierSize, l: typeof entries): SwnTier => ({
		key,
		size,
		label: key === "otherSides" ? "From your other sides" : TIER_LABEL[key as WatchNextTierKey],
		note: key === "otherSides" ? "They fit tonight, but belong to another side." : (TIER_NOTE[key as WatchNextTierKey] ?? null),
		keys: l.map((e) => e.key),
	})
	const fits = later.filter(fitsAll)
	let tiers: SwnTier[]
	const otherTier = tier("otherSides", "md", otherSides)
	if (movies)
		tiers = [tier("upNext", "xl", fits.slice(0, 4)), tier("soon", "lg", fits.slice(4, 16)), tier("later", "md", fits.slice(16)), otherTier, tier("notTonightsFit", "md", later.filter((e) => !fitsAll(e)))]
	else if (!need)
		tiers = [tier("upNext", "xl", later.slice(0, 4)), tier("soon", "lg", later.slice(4, 12)), tier("later", "md", later.slice(12, 32)), tier("someday", "sm", later.slice(32))]
	else {
		const closeKey: WatchNextTierKey = plan.moods.length && plan.onMyServices ? "close" : plan.moods.length ? "otherMoods" : "elsewhere"
		const close = later.filter((e) => e.fit === need - 1)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			otherTier,
			...(close.length ? [tier(plan.need ? closeKey : "notTonight", "md", close)] : []),
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
	const faceKeys = [...new Set(built.sides.flatMap((s) => s.here.slice(0, 4)))]
	const [cards, backdrops, faceDisplays, myServices] = await Promise.all([
		Promise.all(chunks.map((chunk) => getTitleCards(chunk, ctx, taste))).then((c) => c.flat()),
		getDisplayFields(Object.values(pictures)),
		getDisplayFields(faceKeys.slice(0, MAX_KEYS)),
		getServiceCards(ctx.services),
	])
	const titles: Record<string, WatchNextTitle> = {}
	for (const card of cards) {
		const t = wishlistTitle(planForCards, card)
		// The picked side is one more condition: a title of another side does not fit tonight.
		titles[card.key] = picked && !inSide(card.key) ? { ...t, fits: false } : t
	}
	const faces: SwnView["faces"] = {}
	for (const key of faceKeys) {
		const d = faceDisplays.get(key)
		if (d) faces[key] = { title: d.title, poster: d.poster_path ?? null }
	}

	// ---- the sides' summaries and moods ----
	const loved = lovedTitles(person)
	const moodShare = (keys: TitleKey[], mood: MoodKey) =>
		keys.filter((k) => snapshot.facts(k)?.moods.includes(mood)).length / Math.max(1, keys.length)
	const lovedKeys = loved.map((r) => r.key)
	const sides: SwnSide[] = built.sides.map((side, i) => {
		const memberKeys = built.memberKeys[i]
		const moods = MOOD_KEYS.map((m) => ({ m, here: moodShare(memberKeys, m), all: moodShare(lovedKeys, m) }))
			.filter((x) => x.here >= 0.3 && x.here >= 1.3 * x.all)
			.sort((a, b) => b.here / Math.max(0.01, b.all) - a.here / Math.max(0.01, a.all))
			.slice(0, 2)
			.map((x) => x.m)
		const listedKeys = [...sideOf].filter(([, s]) => s === side.id).map(([k]) => k)
		return {
			id: side.id,
			color: COLORS[i % COLORS.length],
			name: side.name,
			share: side.share,
			faces: side.here.slice(0, 4),
			moods,
			listed: listedKeys.length,
			fitting: listedKeys.filter((k) => plan.entries.get(k)!.fit === plan.need && !plan.entries.get(k)!.over && !passed.has(k)).length,
		}
	})
	const unsided = [...sideOf.values()].filter((s) => s === null).length
	notes.push(membersNote, ...built.notes, `${unsided} of ${sideOf.size} listed titles fit no side (closeness under ${NEAR})`)

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
		heroNote: fitting.length ? null : plan.heroNote,
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
		list: o.list,
		member: { slot: member.slot, label: member.label, ratings: member.ratings || person.rated.length, listed: plan.total },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		names: o.names,
		data: watchNext,
		tiers,
		fitting: fitting.map((e) => e.key),
		titles,
		faces,
		sides,
		sideOf: Object.fromEntries(sideOf),
		side: picked,
		passed: o.passed,
		personalOrder: { on: data !== null, note: data ? null : (read.fallbackReason ?? "snapshot-mismatch") },
		notes,
		computedMs: Math.round(performance.now() - startedAt),
	}
}
