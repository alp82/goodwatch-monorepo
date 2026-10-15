// PROTOTYPE - throwaway (#658, map #652). Discover's list for one member, the way Discover builds it (the URL's filters,
// sort and For you, read-only: no list exposure is written), with each title placed in the Side of you it fits.
//
// Sides are #657's settled model (the `tighter` engine): the fewest even sides of 2 to 5 that each hold together. An
// unseen title belongs to the side whose center it is closest to, when it is at least as close as a loved title must
// be to stay in a side (FIT); otherwise it fits no side. Under Best match the list is in the member's personal order
// when their payload loads, and that order is never changed: sides only group it.
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import { discoverFilterDefaults, forYouFromParams } from "~/server/discover-results.server"
import { protoMembers } from "~/server/prototype-better-sides/members.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { buildTighter } from "~/server/prototype-better-sides/engine.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { cosine } from "~/server/taste-portrait/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import { loadTaste } from "~/server/taste/index.server"
import { type TitleCard, getTitleCards, MAX_KEYS } from "~/server/title-cards.server"
import { filterTitles } from "~/server/title-filter/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import type { SDSide, SDView } from "~/ui/prototype-sides-discover/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { parseTitleKey, type TitleKey } from "~/utils/title-key"

/** How many titles of the list the prototype loads (Discover loads 40 at a time; this is about six pages). */
const LIST = 240
/** Each side's own first titles the prototype loads (a side filter, row or lane). */
const PER_SIDE = 48
/** A title fits a side at this closeness to its center, the bar a loved title must clear to stay in its side. */
const FIT = 0.15
/**
 * The stricter rule from the cross-check: a title fits a side when it is at least half as close to the center as the
 * side's own loved titles are on average, and closer to it than to the next side by MARGIN. Near-ties fit no side.
 */
const BAR_SHARE = 0.5
const MARGIN = 0.05

export async function sidesDiscoverView(request: Request, slot: string | null): Promise<SDView | null> {
	const startedAt = performance.now()
	const params = new URL(request.url).searchParams
	const members = await protoMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
	const member = list.find((m) => m.slot === slot) ?? list[0]
	const proto = await protoPerson(member.userId)
	if (!proto) return null
	const { person } = proto

	// The sides and their centers (the engine keeps both in the same order).
	const built = buildTighter(person)
	const centers = built.centers

	// Discover's list for this member.
	const ctx = await getMemberViewerContext(member.userId, "US")
	const taste = await loadTaste({ kind: "member", userId: member.userId })
	let defaults = discoverFilterDefaults(ctx)
	let state = filterStateFromParams(params, defaults)
	const sort = sortFromParams(params, false)
	const forYou = forYouFromParams(params, ctx)
	const run = () => filterTitles({ universe: "catalog", state, sort, taste, forYou: forYou ? "browse" : null, viewer: ctx })
	let result = await run()
	// Some members' saved services carry nothing where they watch: their Discover is empty until they drop On my
	// services, so the prototype starts them without it.
	let servicesDropped = false
	if (result.total === 0 && defaults.onMyServices && result.recoveries.some((r) => r.filter === "services")) {
		defaults = { ...defaults, onMyServices: false }
		state = filterStateFromParams(params, defaults)
		result = await run()
		servicesDropped = true
	}
	const personal = result.sortUsed === "match" && proto.personalOrder
	const ordered = personal ? proto.order(result.keys) : result.keys

	// Each side's bar: half its loved titles' average closeness to its center (never below FIT).
	const bars = centers.map((c, i) => {
		const list = built.memberKeys[i].flatMap((key) => {
			const z = person.zOf(key)
			return z ? [cosine(z, c)] : []
		})
		const mean = list.reduce((a, b) => a + b, 0) / Math.max(1, list.length)
		return Math.max(FIT, Math.round(BAR_SHARE * mean * 100) / 100)
	})

	// Every title's side, over the whole list: the nearest center, if the title clears that side's bar and the margin
	// over the next side. The prototype
	// loads the list's first LIST titles plus each side's own first PER_SIDE, as a side filter or row would.
	const sideOf: Record<string, number | null> = {}
	const closeness: Record<string, number> = {}
	const totals = centers.map(() => 0)
	let noSide = 0
	const picked = new Set<TitleKey>(ordered.slice(0, LIST))
	const perSide = centers.map(() => 0)
	let perNone = 0
	ordered.forEach((key) => {
		const z = person.zOf(key)
		let best = -1
		let similarity = Number.NEGATIVE_INFINITY
		let second = Number.NEGATIVE_INFINITY
		if (z)
			centers.forEach((c, i) => {
				const s = cosine(z, c)
				if (s > similarity) {
					second = similarity
					similarity = s
					best = i
				} else if (s > second) second = s
			})
		const side = best >= 0 && similarity >= bars[best] && similarity - second >= MARGIN ? best : null
		if (side === null) noSide++
		else totals[side]++
		const take = side === null ? perNone++ < PER_SIDE : perSide[side]++ < PER_SIDE
		if (take) picked.add(key)
		if (picked.has(key)) {
			sideOf[key] = side
			if (z) closeness[key] = Math.round(similarity * 100) / 100
		}
	})
	const place: Record<string, number> = {}
	ordered.forEach((key, i) => {
		if (picked.has(key)) place[key] = i
	})
	const keys = [...picked].sort((a, b) => place[a] - place[b])

	const cards: TitleCard[] = []
	for (let i = 0; i < keys.length; i += MAX_KEYS)
		cards.push(...(await getTitleCards(keys.slice(i, i + MAX_KEYS), ctx, taste, state.ageLimit === undefined ? null : result.ladder)))

	// The loved titles that stand for each side, as the Taste page shows them.
	const loved = lovedTitles(person).length
	const posterKeys = new Set(built.sides.flatMap((s) => s.here.slice(0, 4)))
	const displays = await titleDisplays(posterKeys)
	const posters: Record<string, PortraitTitle> = {}
	for (const key of posterKeys) {
		const display = displays.get(key)
		if (!display) continue
		const { mediaType, tmdbId } = parseTitleKey(key)
		posters[key] = {
			key,
			mediaType,
			anime: false,
			tmdbId,
			...display,
			score: null,
			mine: person.input.scores.get(key) ?? null,
			match: null,
			onMyServices: null,
			reasons: [],
			services: null,
		}
	}
	const sides: SDSide[] = built.sides.map((side, i) => ({
		index: i,
		name: side.name,
		line: side.line,
		share: side.share,
		count: side.count,
		lift: side.lift,
		here: side.here.slice(0, 4).filter((k) => posters[k]),
		edges: side.edges.slice(0, 3).map((e) => e.line),
	}))

	const { keys: _keys, moved: _moved, personalOrder: _po, ...counts } = result
	return {
		member: { slot: member.slot, label: member.label, ratings: member.ratings || person.rated.length, rated: person.rated.length, loved },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		sides,
		loose: built.loose,
		posters,
		cards,
		sideOf,
		closeness,
		place,
		list: LIST,
		totals,
		noSide,
		listTotal: ordered.length,
		counts: { total: counts.total, hidden: counts.hidden, recoveries: counts.recoveries, optionCounts: counts.optionCounts, approximate: counts.approximate, ladder: counts.ladder },
		defaults,
		servicesDropped,
		sortUsed: result.sortUsed,
		forYou,
		movedUp: result.movedUp ?? 0,
		order: personal ? "personal" : result.sortUsed === "match" ? "best-match" : "sort",
		personalOrderNote: proto.personalOrderNote,
		fit: { bars, margin: MARGIN },
		computedMs: Math.round(performance.now() - startedAt),
	}
}
