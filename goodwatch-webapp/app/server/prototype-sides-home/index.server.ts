// PROTOTYPE - throwaway (#660, map #652). What the Sides-of-you-on-Home prototype shows for one member: the TV home
// they have today (Tonight, My shows, their two services, read the way the start page reads them) and their sides
// from the better-sides engine the owner chose on #657 (`tighter`: even groups of 2 to 5 that each hold together).
// Inside a side, personal order ranks the unseen titles when the member has a payload (sides group, personal order
// ranks); otherwise they keep the engine's order. Read-only: nothing is written.
import { MOOD_BY_KEY, MOOD_KEYS, type MoodKey } from "~/domain/moods"
import { loadMemberHome, loadTvServices } from "~/server/living-room/tv-loader.server"
import { enrich } from "~/server/prototype-better-sides/index.server"
import { buildTighter } from "~/server/prototype-better-sides/engine.server"
import { protoMembers } from "~/server/prototype-better-sides/members.server"
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import { loadTaste } from "~/server/taste/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"
import { portraitListTitle } from "~/ui/living-room/tv/tv-taste"
import type { HomeSide, SidesHomeView } from "~/ui/prototype-sides-home/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleKey, type TitleKey } from "~/utils/title-key"

/** A TV key ("movie-603") back to the title's key. */
const keyOf = (tv: string): TitleKey => {
	const [type, id] = tv.split("-")
	return titleKey(type as "movie" | "show", Number(id))
}

/** How many unseen titles a side carries to the TV. */
const PICKS = 12
/** A side's moods: in at least this share of the side. */
const MOOD_FLOOR = 0.35
/** Home's floor (see below). */
const HOME_MIN_LOVED = 20
const HOME_MIN_SIDE = 8

export async function sidesHomeView(request: Request, slot: string | null): Promise<SidesHomeView | null> {
	const startedAt = performance.now()
	const members = await protoMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
	const member = list.find((m) => m.slot === slot) ?? list[0]
	const proto = await protoPerson(member.userId)
	if (!proto) return null
	const { person } = proto

	const [viewer, taste] = await Promise.all([getMemberViewerContext(member.userId, "US"), loadTaste({ kind: "member", userId: member.userId })])
	const [home, services] = await Promise.all([loadMemberHome(viewer, taste), loadTvServices(viewer.services)])

	const built = buildTighter(person)
	const loved = lovedTitles(person)
	const lovedShare = (mood: MoodKey) => loved.filter((r) => r.facts.moods.includes(mood)).length / Math.max(1, loved.length)
	const byKey = new Map(person.rated.map((r) => [r.key, r]))

	// Sides group, personal order ranks.
	for (const side of built.sides) side.moreOfThis = proto.order(side.moreOfThis)

	const keys = new Set<TitleKey>()
	for (const side of built.sides) for (const key of [...side.here, side.image, ...side.moreOfThis]) if (key != null) keys.add(key)
	const titles = await enrich(person, keys)
	const franchise = (key: TitleKey) =>
		(titles[key]?.title ?? String(key))
			.toLowerCase()
			.replace(/^(the|a|an) /, "")
			.split(/:| part | \d| - /)[0]
			.trim()
	const onePer = (keys: TitleKey[]) => {
		const seen = new Set<string>()
		return keys.filter((key) => {
			const f = franchise(key)
			if (seen.has(f)) return false
			seen.add(f)
			return true
		})
	}

	// Home's floor: a thin history makes sides that overclaim ("Half of what you love" for six titles), so Home shows
	// sides only from HOME_MIN_LOVED loved titles, and only sides of HOME_MIN_SIDE titles or more.
	const kept = built.sides.map((side, i) => ({ side, memberKeys: built.memberKeys[i] })).filter((k) => k.side.count >= HOME_MIN_SIDE)
	const floor = loved.length < HOME_MIN_LOVED || kept.length < 2
	const chosen = floor ? [] : kept

	// Unseen titles per side, one per franchise, none of a franchise the side's loved titles already hold.
	const lovedFranchises = new Set(chosen.flatMap((k) => k.side.here.map(franchise)))
	const unseenOf = chosen.map((k) => onePer(k.side.moreOfThis).filter((key) => titles[key] && !lovedFranchises.has(franchise(key))))
	// A title in two sides stays in the one where personal order puts it higher (a filter, not a re-rank).
	const sideOfPick: Map<TitleKey, number> = new Map()
	unseenOf.forEach((list, i) =>
		list.forEach((key, at) => {
			const was = sideOfPick.get(key)
			if (was === undefined || unseenOf[was].indexOf(key) > at) sideOfPick.set(key, i)
		}),
	)

	const sides: HomeSide[] = chosen.map(({ side, memberKeys }, i) => {
		// The moods Watch next opens with: the ones most of the side is, with how much more it is than the rest of
		// what the member loves as the tie-break, so a comedy side opens on Funny even when everything they love is funny.
		const moods = MOOD_KEYS.map((mood) => {
			const inSide = memberKeys.filter((key) => byKey.get(key)?.facts.moods.includes(mood)).length / Math.max(1, memberKeys.length)
			return { mood, inSide, lift: inSide / Math.max(0.02, lovedShare(mood)) }
		})
			.filter((m) => m.inSide >= MOOD_FLOOR && m.lift >= 0.9)
			.sort((a, b) => b.inSide - a.inSide || b.lift - a.lift)
			.slice(0, 2)
			.map((m) => ({ key: m.mood, name: MOOD_BY_KEY[m.mood].name }))
		const unseen = unseenOf[i].filter((key) => sideOfPick.get(key) === i).map((key) => titles[key])
		// On the member's services when enough of the side streams there, as Watch next does by default; the order
		// stays personal order's either way.
		const mine = unseen.filter((t) => t.onMyServices)
		const onServices = person.input.services.length > 0 && mine.length >= 4
		const picks = (onServices ? mine : unseen).slice(0, PICKS)
		const here = onePer(side.here).flatMap((key) => (titles[key] ? [titles[key]] : []))
		// The names-off title: the two best-known of the side's typical loved titles.
		const known = [...here]
			.sort((a, b) => (byKey.get(b.key)?.facts.votes ?? 0) - (byKey.get(a.key)?.facts.votes ?? 0))
			.slice(0, 2)
			.map((t) => t.title)
		const image = side.image != null ? titles[side.image] : undefined
		return {
			id: side.id,
			n: i + 1,
			name: side.name,
			line: side.line,
			share: side.share,
			count: side.count,
			loved: here.slice(0, 6).map(portraitListTitle),
			known,
			picks: picks.map((t) => ({ ...portraitListTitle(t), streams: t.onMyServices === true })),
			onServices,
			moods,
			// Step edges repeat the side's name ("Hopeful stories, but mysterious"): the part after it is the edge.
			edges: side.edges.slice(0, 3).map((e) => ({ chip: e.chip, line: e.line.startsWith(`${side.name}, `) ? e.line.slice(side.name.length + 2) : e.line })),
			backdrop: image?.backdrop ?? here.find((t) => t.backdrop)?.backdrop ?? null,
			rank: 0,
		}
	})

	// Where each side's best pick stands across every side's picks: "a side for tonight" takes the side holding the
	// best one. With a payload that is personal order; without one, the engine's match (personal order is not there to ask).
	const union = [...new Set(sides.flatMap((side) => side.picks.map((t) => keyOf(t.key))))]
	const everyPick = proto.personalOrder ? proto.order(union) : [...union].sort((a, b) => (titles[b]?.match ?? 0) - (titles[a]?.match ?? 0))
	for (const side of sides) {
		const at = side.picks.map((t) => everyPick.indexOf(keyOf(t.key))).filter((i) => i >= 0)
		side.rank = at.length ? Math.min(...at) : Number.MAX_SAFE_INTEGER
	}

	const tvHome: TvHomeData = {
		member: true,
		startTitles: [],
		picture: null,
		tonight: home.tonight,
		shows: home.shows,
		services,
		scope: { country: viewer.country, services: viewer.services },
	}

	return {
		member: { slot: member.slot, label: member.label, ratings: member.ratings || person.rated.length, loved: loved.length },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		home: tvHome,
		sides,
		loose: built.loose,
		floor,
		hasServices: person.input.services.length > 0,
		headline: built.headline,
		personalOrder: { on: proto.personalOrder, note: proto.personalOrderNote },
		computedMs: Math.round(performance.now() - startedAt),
	}
}
