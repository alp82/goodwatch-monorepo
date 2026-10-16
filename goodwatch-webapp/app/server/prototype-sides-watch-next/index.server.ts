// PROTOTYPE - throwaway (#659, map #652). One member's real Watch next with the groups of titles they love (production's
// Sides of you), read-only: nothing is written (no list exposure, no plan store). The Wishlist is planned as
// production plans it (fit, time, Not tonight), ordered by the member's personal order as production orders it
// (franchise groups, then the fitting mix), and every title is judged by production's rule for loved titles (#666):
// its nearest group, at least 0.3 close, and not far below the catalog on an attribute the group's name claims; others
// fit no group. Groups are production's sides (a copy of origin/main's taste-portrait/sides.server.ts in
// production-sides.server.ts). Picked groups narrow like a mood; personal order ranks: a group never moves a title
// ahead of another. Each group sits at one of production's moods for it (round 3: beside it, or inside it).
import { MAX_MOODS, MOOD_KEYS, type MoodKey, maskOfMoods } from "~/domain/moods"
import type { WatchNextTierKey, WatchNextTierSize } from "~/domain/watch-next"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import {
	loadPersonalOrder,
	mixPersonalOrderFitting,
	orderPersonalOrder,
} from "~/server/personal-order/reader.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { loadTaste } from "~/server/taste/index.server"
import {
	MAX_KEYS,
	getDisplayFields,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import {
	type Plan,
	type WatchNext,
	type WatchNextTitle,
	pictureKeys,
	planWatchNext,
	sortFactsOutsideSnapshot,
	wishlistTitle,
} from "~/server/watch-next.server"
import { TASTE } from "~/ui/prototype-sides-watch-next/label"
import {
	COMBINE,
	RULE,
	type SwnGroup,
	type SwnTier,
	type SwnView,
	type TasteMood,
	type VariantKey,
} from "~/ui/prototype-sides-watch-next/model"
import { WORD_BY_ID } from "~/ui/prototype-sides-watch-next/words"
import { TIER_LABEL, TIER_NOTE, misfitWords } from "~/ui/watch-next/labels"
import { getUserIdFromRequest } from "~/utils/auth"
import type { TitleKey } from "~/utils/title-key"
import { membersNote, swnMembers } from "./members.server"
import {
	buildSides,
	franchiseOf,
	placeOfTitle,
} from "./production-sides.server"
import { wordsModel } from "./words.server"

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
	/** "Inside the moods": picked moods widened to the whole mood. */
	wide: MoodKey[]
	/** The groups' trait names, behind the toggle (words gate, #656). */
	names: boolean
	/** Round 4: the picks (groups g1 and words m:funny), widened words, words that bring titles up, the preset. */
	picks: string[]
	wideWords: string[]
	boost: string[]
	from: string | null
	passed: TitleKey[]
}

export async function swnView(
	request: Request,
	o: SwnOptions,
): Promise<SwnView | null> {
	const startedAt = performance.now()
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const members = await swnMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [
		...(me
			? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }]
			: []),
		...members,
	]
	const member = list.find((m) => m.slot === o.slot) ?? list[0]
	const [proto, ctx, taste] = await Promise.all([
		protoPerson(member.userId),
		getMemberViewerContext(member.userId, "US"),
		loadTaste({ kind: "member", userId: member.userId }),
	])
	if (!proto) return null
	const { person } = proto
	const movies = o.list === "movies"
	const rule = RULE[o.variant]
	const options = {
		sort: "match" as const,
		// Round 4 picks its own words; production's moods stay unpicked.
		moods: rule === "words" ? [] : o.moods,
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
	const todayOrder = [
		...plan.head.map((e) => e.key),
		...plan.tiers.flatMap((t) => t.keys),
	]
	const notes: string[] = []

	// ---- groups ----
	const built = buildSides(person)
	const idOf = new Map(built.sides.map((side, i) => [side.id, `g${i + 1}`]))
	// In a group by production's rule, close to one (the edge), or neither.
	const placeOf = new Map<
		TitleKey,
		{ id: string; how: "in" | "close" } | null
	>()
	for (const key of plan.entries.keys()) {
		const z = person.zOf(key)
		const place = z ? placeOfTitle(z, built.protoGroups) : null
		const id = place ? idOf.get(place.side) : undefined
		placeOf.set(key, place && id ? { id, how: place.how } : null)
	}
	const groupOf = (key: TitleKey) =>
		placeOf.get(key)?.how === "in" ? placeOf.get(key)!.id : null
	const known = o.groups.filter((g) => [...idOf.values()].includes(g))
	const picked =
		rule === "any"
			? known.slice(0, Math.max(0, MAX_MOODS - plan.moods.length))
			: []
	const inPicked = (key: TitleKey) => picked.includes(groupOf(key) ?? "")
	const inMood = (e: { moodMask: number }, mood: MoodKey) =>
		(e.moodMask & (1 << MOOD_KEYS.indexOf(mood))) !== 0

	// ---- round 4: the filters' words next to the groups ----
	const { columns } = snapshot
	const wm =
		rule === "words"
			? wordsModel({
					variant: o.variant,
					combine: COMBINE[o.variant] ?? "any",
					entries: [...plan.entries.values()],
					onMyServices: plan.onMyServices,
					masksOf: (key) => {
						const row = snapshot.rowOf(key)
						return row < 0
							? null
							: {
									moods: columns.moods[row],
									themes: columns.themes[row],
									styles: columns.styles[row],
								}
					},
					groupOf,
					placeOf: (key) => placeOf.get(key) ?? null,
					groups: built.sides.map((side) => ({
						id: idOf.get(side.id) ?? "",
						loved:
							built.protoGroups.find((g) => g.side === side.id)?.members ?? [],
					})),
					picks: o.picks,
					wide: o.wideWords,
					boost: o.boost,
					from: o.from,
				})
			: null

	// Where each group sits among the moods: the mood most of its listed titles are in, so that picking that mood in
	// your taste reaches the group (production's moods for the group break ties). Pairs go best first, one group per
	// mood; a group left over takes its best mood anyway, and a group with no listed titles in any mood sits nowhere.
	const listed = [...plan.entries.values()]
	const pairs = built.sides.flatMap((side, rank) => {
		const id = idOf.get(side.id) ?? ""
		const mine = listed.filter((e) => groupOf(e.key) === id)
		return MOOD_KEYS.map((m) => ({
			id,
			m,
			n: mine.filter((e) => inMood(e, m)).length,
			prod: side.moods.includes(m) ? side.moods.indexOf(m) : 9,
			rank,
		})).filter((p) => p.n > 0)
	})
	pairs.sort((a, b) => b.n - a.n || a.prod - b.prod || a.rank - b.rank)
	const taken = new Set<MoodKey>()
	const atOf = new Map<string, MoodKey | null>(
		built.sides.map((side) => [idOf.get(side.id) ?? "", null]),
	)
	for (const p of pairs)
		if (!atOf.get(p.id) && !taken.has(p.m)) {
			atOf.set(p.id, p.m)
			taken.add(p.m)
		}
	for (const p of pairs) if (!atOf.get(p.id)) atOf.set(p.id, p.m)
	// "Inside the moods": a mood that carries groups is picked as that mood in your taste, unless widened.
	const tasteMoods: Partial<Record<MoodKey, TasteMood>> = {}
	for (const [id, at] of atOf) {
		if (!at) continue
		tasteMoods[at] = tasteMoods[at] ?? { groups: [], count: 0 }
		tasteMoods[at].groups.push(id)
	}
	// A mood carries your taste only when some of its titles are in it.
	const countedNow = [...plan.entries.values()].filter(
		(e) => !plan.onMyServices || e.onServices !== false,
	)
	for (const [m, t] of Object.entries(tasteMoods) as [MoodKey, TasteMood][]) {
		t.count = countedNow.filter(
			(e) => inMood(e, m) && t.groups.includes(groupOf(e.key) ?? ""),
		).length
		if (!t.count) delete tasteMoods[m]
	}
	const narrowed =
		rule === "inside"
			? plan.moods.filter((m) => tasteMoods[m] && !o.wide.includes(m))
			: []
	const wide =
		rule === "inside"
			? plan.moods.filter((m) => tasteMoods[m] && o.wide.includes(m))
			: []
	const inTasteOf = (e: { key: TitleKey }, m: MoodKey) =>
		tasteMoods[m]?.groups.includes(groupOf(e.key) ?? "") ?? false
	// The groups that narrow tonight: the picked ones, or those inside the narrowed moods.
	const focus = wm
		? wm.narrows
			? wm.focus
			: []
		: rule === "any"
			? picked
			: narrowed.flatMap((m) => tasteMoods[m]!.groups)
	const closeToPicked = (key: TitleKey) => {
		const place = placeOf.get(key)
		if (place?.how !== "close" || !focus.includes(place.id)) return false
		const e = plan.entries.get(key)
		return (
			rule === "any" ||
			(e !== undefined &&
				narrowed.some(
					(m) => inMood(e, m) && tasteMoods[m]!.groups.includes(place.id),
				))
		)
	}

	// ---- fit: production's, with the picked groups among the moods ("any"), or moods narrowed to your taste ----
	const passed = new Set(o.passed)
	const moodMask = maskOfMoods(plan.moods)
	const moodCondition =
		plan.moods.length > 0 ||
		(rule === "any" && picked.length > 0) ||
		(wm?.view.picks.length ?? 0) > 0
	const onServices = (e: { onServices: boolean | null }) =>
		plan.onMyServices && e.onServices !== false ? 1 : 0
	const need = wm
		? (wm.view.picks.length ? 1 : 0) + (plan.onMyServices ? 1 : 0)
		: rule === "any" && picked.length
			? (moodCondition ? 1 : 0) + (plan.onMyServices ? 1 : 0)
			: plan.need
	const entries = [...plan.entries.values()].map((e) => {
		if (wm)
			return {
				...e,
				fit: (wm.view.picks.length && wm.hit(e.key) ? 1 : 0) + onServices(e),
			}
		if (narrowed.length) {
			const hit = plan.moods.some(
				(m) => inMood(e, m) && (!narrowed.includes(m) || inTasteOf(e, m)),
			)
			return { ...e, fit: (hit ? 1 : 0) + onServices(e) }
		}
		if (!picked.length) return { ...e }
		const hit =
			(plan.moods.length > 0 && (e.moodMask & moodMask) !== 0) ||
			inPicked(e.key)
		return { ...e, fit: (hit ? 1 : 0) + onServices(e) }
	})
	const byKey = new Map(entries.map((e) => [e.key, e]))
	const tiered = (a: (typeof entries)[number], b: (typeof entries)[number]) =>
		Math.sign(a.over) - Math.sign(b.over) ||
		b.fit - a.fit ||
		a.over - b.over ||
		Number(passed.has(a.key)) - Number(passed.has(b.key))
	const read = await loadPersonalOrder(member.userId, snapshot).catch(() => ({
		data: null,
		fallbackReason: "error",
	}))
	const data =
		read.data && read.data.payload.snapshotVersion === snapshot.version
			? read.data
			: null
	let ranked: typeof entries
	const fitsAllOf = (e: (typeof entries)[number]) =>
		e.fit === need && !e.over && !passed.has(e.key)
	if (data) {
		const groups = orderPersonalOrder(
			entries.map((e) => e.key),
			data,
			snapshot,
			false,
		)
		ranked = groups.keys.map((k) => byKey.get(k)!).sort(tiered)
		const fittingKeys = ranked
			.filter((e) => e.fit === need && !e.over && !passed.has(e.key))
			.map((e) => e.key)
		const mix = mixPersonalOrderFitting(
			fittingKeys,
			data,
			snapshot,
			groups.ranks,
		)
		const replace = new Set(fittingKeys)
		// Round 4: words that bring titles up, or your taste, go first among the fits; personal order keeps the rest.
		const mixed = wm
			? [...mix.keys].sort((a, b) => wm.lift(b) - wm.lift(a))
			: mix.keys
		let i = 0
		ranked = ranked.map((e) =>
			replace.has(e.key) ? byKey.get(mixed[i++])! : e,
		)
	} else {
		const at = new Map(todayOrder.map((k, i) => [k, i]))
		ranked = [...entries]
			.sort((a, b) => (at.get(a.key) ?? 1e9) - (at.get(b.key) ?? 1e9))
			.sort(tiered)
		if (wm)
			ranked = ranked.sort(
				(a, b) =>
					Number(fitsAllOf(b)) - Number(fitsAllOf(a)) ||
					(fitsAllOf(a) ? wm.lift(b.key) - wm.lift(a.key) : 0),
			)
		notes.push(
			`Personal order not loaded (${read.data ? "snapshot-mismatch" : (read.fallbackReason ?? "none")}): today's Best match order instead`,
		)
	}

	// ---- head and tiers, as production cuts them ----
	const fitsAll = (e: (typeof entries)[number]) => e.fit === need && !e.over
	const fitting = ranked.filter(fitsAll)
	// Nothing fits: the closest titles lead, as production's hero does.
	const head = (fitting.length || !ranked.length ? fitting : ranked).slice(
		0,
		1 + THEN,
	)
	const inHead = new Set(head.map((e) => e.key))
	const rest = ranked.filter((e) => !inHead.has(e.key))
	// With your taste narrowing: titles close to it that fit everything else ("Close to your taste").
	const servicesOk = (e: (typeof entries)[number]) =>
		onServices(e) === (plan.onMyServices ? 1 : 0)
	const closeTaste = wm
		? wm.narrows
			? rest.filter(
					(e) =>
						!wm.hit(e.key) &&
						wm.hit(e.key, true) &&
						placeOf.get(e.key)?.how === "close" &&
						focus.includes(placeOf.get(e.key)?.id ?? "") &&
						!e.over &&
						servicesOk(e),
				)
			: []
		: focus.length
			? rest.filter(
					(e) =>
						closeToPicked(e.key) &&
						!e.over &&
						e.fit === need - 1 &&
						servicesOk(e),
				)
			: []
	const isCloseTaste = new Set(closeTaste.map((e) => e.key))
	const later = rest.filter((e) => !isCloseTaste.has(e.key))
	// Production's notes speak of moods; with your taste narrowing they say which choices a title misses.
	const groupNote = (key: SwnTier["key"]): string | null | undefined => {
		if (wm) {
			if (!wm.view.picks.length) return undefined
			if (key === "otherMoods") return "In none of your picks."
			if (key === "close")
				return "In one of your picks but not on your services, or on them but in none of your picks."
			if (key === "notTonight")
				return "In none of your picks, and not on your services."
			return undefined
		}
		if (!focus.length) return undefined
		const moods = plan.moods.length > 0
		const none = moods ? "In none of your picks" : `Not ${TASTE.inline}`
		if (key === "otherMoods") return `${none}.`
		if (key === "close")
			return moods
				? "In one of your picks but not on your services, or on them but in none of your picks."
				: `${TASTE.in} but not on your services, or on them but not ${TASTE.inline}.`
		if (key === "notTonight") return `${none}, and not on your services.`
		return undefined
	}
	const tier = (
		key: SwnTier["key"],
		size: WatchNextTierSize,
		l: typeof entries,
	): SwnTier => ({
		key,
		size,
		label:
			key === "closeTaste" ? TASTE.close : TIER_LABEL[key as WatchNextTierKey],
		note:
			key === "closeTaste"
				? "Near the taste you picked, but not in it."
				: groupNote(key) !== undefined
					? (groupNote(key) ?? null)
					: (TIER_NOTE[key as WatchNextTierKey] ?? null),
		keys: l.map((e) => e.key),
	})
	const fits = later.filter(fitsAll)
	let tiers: SwnTier[]
	const otherTier = [tier("closeTaste", "md", closeTaste)]
	if (movies)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			...otherTier,
			tier(
				"notTonightsFit",
				"md",
				later.filter((e) => !fitsAll(e)),
			),
		]
	else if (!need)
		tiers = [
			tier("upNext", "xl", later.slice(0, 4)),
			tier("soon", "lg", later.slice(4, 12)),
			tier("later", "md", later.slice(12, 32)),
			tier("someday", "sm", later.slice(32)),
		]
	else {
		const closeKey: WatchNextTierKey =
			moodCondition && plan.onMyServices
				? "close"
				: moodCondition
					? "otherMoods"
					: "elsewhere"
		const close = later.filter((e) => e.fit === need - 1)
		tiers = [
			tier("upNext", "xl", fits.slice(0, 4)),
			tier("soon", "lg", fits.slice(4, 16)),
			tier("later", "md", fits.slice(16)),
			...otherTier,
			...(close.length ? [tier(closeKey, "md", close)] : []),
			tier(
				"notTonight",
				"sm",
				later.filter((e) => e.fit < need - 1),
			),
		]
	}
	tiers = tiers.filter((t) => t.keys.length)

	// ---- cards ----
	const shownKeys = [
		...head.map((e) => e.key),
		...tiers.flatMap((t) => t.keys),
	].slice(0, CARDED)
	const chunks: TitleKey[][] = []
	for (let i = 0; i < shownKeys.length; i += MAX_KEYS)
		chunks.push(shownKeys.slice(i, i + MAX_KEYS))
	const planForCards = {
		...plan,
		need,
		entries: new Map(entries.map((e) => [e.key, e])),
	} as Plan
	const pictures = pictureKeys(plan, snapshot)
	// Round 4: a picture for each theme and style, from a title on the list with it (moods keep production's).
	const wordPictures = new Map<string, TitleKey>()
	if (wm) {
		const used = new Set<TitleKey>(Object.values(pictures))
		for (const w of wm.view.words) {
			const word = WORD_BY_ID[w.id]
			if (word.kind === "mood") {
				const k = pictures[word.key as MoodKey]
				if (k !== undefined) wordPictures.set(w.id, k)
				continue
			}
			const mask = (e: { key: TitleKey }) => {
				const row = snapshot.rowOf(e.key)
				if (row < 0) return 0
				return word.kind === "theme" ? columns.themes[row] : columns.styles[row]
			}
			const candidates = plan.pictureOrder.filter(
				(e) => e.hasBackdrop && mask(e) & (1 << word.bit),
			)
			const pick = candidates.find((e) => !used.has(e.key)) ?? candidates[0]
			if (pick) {
				used.add(pick.key)
				wordPictures.set(w.id, pick.key)
			}
		}
	}
	const faceKeys = [
		...new Set(
			built.sides.flatMap((s) => [
				...s.here.slice(0, 6),
				...(s.image ? [s.image] : []),
			]),
		),
	]
	const [cards, backdrops, faceDisplays, myServices] = await Promise.all([
		Promise.all(chunks.map((chunk) => getTitleCards(chunk, ctx, taste))).then(
			(c) => c.flat(),
		),
		getDisplayFields([
			...new Set([...Object.values(pictures), ...wordPictures.values()]),
		]),
		getDisplayFields(faceKeys.slice(0, MAX_KEYS)),
		getServiceCards(ctx.services),
	])
	const titles: Record<string, WatchNextTitle> = {}
	for (const card of cards) titles[card.key] = wishlistTitle(planForCards, card)
	// What each movie misses tonight, first reason first (production's: time, mood, services), with your taste
	// narrowing: "Not in your taste", or "Close to your taste" for one near it.
	const misfits: Record<string, string> = {}
	if (movies && wm && wm.view.picks.length)
		for (const e of entries) {
			if ((e.fit === need && !e.over) || isCloseTaste.has(e.key)) continue
			const offServices = plan.onMyServices && e.onServices === false
			const words =
				e.over > 0
					? misfitWords({ why: "time", over: e.over })
					: !wm.hit(e.key)
						? wm.hit(e.key, true)
							? placeOf.get(e.key)?.how === "close"
								? TASTE.close
								: `Not ${TASTE.inline}`
							: "Not in your picks"
						: offServices
							? "Not on your services"
							: null
			if (words) misfits[e.key] = words
		}
	else if (movies && focus.length)
		for (const e of entries) {
			// The "Close to your taste" step says so in its heading.
			if ((e.fit === need && !e.over) || isCloseTaste.has(e.key)) continue
			const offServices = plan.onMyServices && e.onServices === false
			const taste = `${closeToPicked(e.key) ? TASTE.close : `Not ${TASTE.inline}`}${offServices ? ", not on your services" : ""}`
			const anyMood = plan.moods.length > 0 && (e.moodMask & moodMask) !== 0
			const words =
				e.over > 0
					? misfitWords({ why: "time", over: e.over })
					: rule === "any" && !anyMood && !inPicked(e.key)
						? plan.moods.length
							? "Another mood or taste"
							: taste
						: rule === "inside" && !anyMood
							? "Another mood"
							: rule === "inside" &&
									e.fit < need &&
									!(plan.onMyServices && e.onServices === false)
								? taste
								: plan.onMyServices && e.onServices === false
									? "Not on your services"
									: null
			if (words) misfits[e.key] = words
		}

	// ---- the groups, counted as the moods are ----
	const counted = entries.filter(
		(e) => !plan.onMyServices || e.onServices !== false,
	)
	const groups: SwnGroup[] = built.sides.map((side) => {
		const id = idOf.get(side.id)!
		const art = [side.image, ...side.here].find(
			(k) => k && faceDisplays.get(k)?.backdrop_path,
		)
		return {
			id,
			name: side.name,
			// One poster per franchise: two Avengers films would show the same thing twice.
			posters: side.here
				.filter((key) => faceDisplays.has(key))
				.filter(
					(key, i, all) =>
						all.findIndex(
							(k) =>
								franchiseOf(faceDisplays.get(k)?.title ?? "") ===
								franchiseOf(faceDisplays.get(key)?.title ?? ""),
						) === i,
				)
				.slice(0, 3)
				.map((key) => ({
					key,
					title: faceDisplays.get(key)?.title ?? "",
					poster: faceDisplays.get(key)?.poster_path ?? null,
				})),
			backdrop: art ? (faceDisplays.get(art)?.backdrop_path ?? null) : null,
			count: counted.filter((e) => groupOf(e.key) === id).length,
			close: counted.filter(
				(e) =>
					placeOf.get(e.key)?.id === id && placeOf.get(e.key)?.how === "close",
			).length,
			moods: side.moods,
			at: atOf.get(id) ?? null,
		}
	})
	const places = [...placeOf.values()]
	notes.push(
		membersNote,
		`Production's sides (#666 rule): ${groups.length} groups`,
		`Of ${placeOf.size} listed titles: ${places.filter((p) => p?.how === "in").length} in a group, ${places.filter((p) => p?.how === "close").length} close to one (nearest group at least 0.15 close, but missing the rule), ${places.filter((p) => !p).length} neither`,
	)

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
		heroNote: fitting.length
			? null
			: moodCondition && !plan.moods.length
				? "closestToMoods"
				: plan.heroNote,
		thenColumn: headTitles.slice(1),
		tiers: [],
		moodCounts: plan.moodCounts,
		moodPictures: Object.fromEntries(
			MOOD_KEYS.map((mood) => {
				const key = pictures[mood]
				const backdropPath =
					key === undefined ? null : backdrops.get(key)?.backdrop_path
				return [
					mood,
					key !== undefined && backdropPath ? { key, backdropPath } : null,
				]
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
		member: {
			slot: member.slot,
			label: member.label,
			ratings: member.ratings || person.rated.length,
			listed: plan.total,
		},
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		data: watchNext,
		tiers,
		fitting: fitting.map((e) => e.key),
		titles,
		misfits,
		names: o.names,
		groups,
		placeOf: Object.fromEntries(placeOf),
		picked,
		tasteMoods,
		wide,
		words: wm
			? {
					...wm.view,
					words: wm.view.words.map((w) => {
						const k = wordPictures.get(w.id)
						return {
							...w,
							backdrop:
								k === undefined
									? null
									: (backdrops.get(k)?.backdrop_path ?? null),
						}
					}),
				}
			: null,
		passed: o.passed,
		personalOrder: {
			on: data !== null,
			note: data ? null : (read.fallbackReason ?? "snapshot-mismatch"),
		},
		notes,
		computedMs: Math.round(performance.now() - startedAt),
	}
}
