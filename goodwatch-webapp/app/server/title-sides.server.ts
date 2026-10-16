// Taste groups on the title page (#672, decided in #661): one line in the overview card that tells a signed-in member
// where an unseen title sits in their Taste: on one of their sides, or just past one (in a place or a step just past
// it, or between two sides). A title that fits no side says nothing, and so does a title the member has rated,
// watched, marked Not interested, dropped, or passed on: it can't be a recommendation.
//
// The sides are the Taste page's (taste-portrait/sides.server.ts). A title is on a side by the rule its loved titles
// follow: its nearest side, when at least 0.3 close to its center and the side's name describes it. The edges are the
// Taste page's own, read from its cached view.
//
// - Who sees it: every signed-in member who has taste groups, with their names. There is no switch.
// - Cost: the grouping is kept in process memory per member for 10 minutes, keyed by everything it reads (ratings,
//   seen, Want to See, skipped) and the snapshot version. The edges come from the Taste page's view, cached in Redis
//   for 10 minutes; building it when it isn't cached also warms the Taste page.
// - How often: the title page asks more than the sides' own rule (BARS), so it speaks about as often as the prototype
//   the owner chose did: on a side when at least 0.6 close to its center, just past it when at least 0.45.
// - The page doesn't wait long: past its budget the line is left out for this request (titleSidesWithin).
import { createHash } from "node:crypto"
import type { MoodKey } from "~/domain/moods"
import { recommendable } from "~/domain/recommendable"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import type { ShortName } from "~/server/taste-portrait/group-names.server"
import {
	getTastePortrait,
	portraitInput,
	portraitViewer,
} from "~/server/taste-portrait/index.server"
import {
	cosine,
	readPerson,
	titleZ,
} from "~/server/taste-portrait/person.server"
import {
	type NamedSides,
	franchiseOf,
	namedSides,
	placeTitle,
	sideMoods,
} from "~/server/taste-portrait/sides.server"
import type { SideDraft } from "~/server/taste-portrait/sides.server"
import { loadTaste } from "~/server/taste/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** The loved titles the line shows: three, or two from each side when the title is between two. */
const NEAR = 3
const NEAR_BETWEEN = 2
// The closest loved titles looked up for their posters, before one per franchise.
const NEAR_POOL = 12
// The title page speaks less often than a side holds titles (#661: as often as the prototype did): on a side only when
// at least 0.6 close to its center, and just past it only when at least 0.45 close (0.15 short of on).
const BARS = { on: 0.6, past: 0.45 }
const KEEP_MS = 10 * 60_000
const MAX_KEPT = 500
/** How long a title page waits for the line, from the loader's start. */
export const TITLE_BUDGET_MS = 500

/** One side as the line names it. */
export interface TitleSidesSide {
	/** "Side 2": its place among the member's sides, largest first. */
	number: number
	/** Its name. */
	name: string | null
	/** Its name's traits and noun (["dark", "tense"], "crime"), for a shorter line; only with the name. */
	short: ShortName | null
	/** The moods Watch next opens the side with. */
	moods: MoodKey[]
	/** Its loved titles closest to this title, closest first, one per franchise. */
	near: {
		mediaType: "movie" | "show"
		tmdbId: number
		title: string
		poster: string
	}[]
}

/** Where the title sits in the member's Taste, for the overview card's line. */
export interface TitleSides {
	/** On a side, or just past one. */
	at: "on" | "edge"
	/** Just past: in a place (country, language, decade, format, animation), a step, or between two sides. */
	edge: "place" | "step" | "between" | null
	/** What sets a place or step apart, after the side's name ("from South Korea", "but darkly funny"). */
	edgeTail: string | null
	side: TitleSidesSide
	/** Between two sides: the other one. */
	other: TitleSidesSide | null
}

const kept = new Map<
	string,
	{ until: number; named: Promise<NamedSides | null> }
>()

/** The member's sides before their edges, kept per member and everything the grouping reads. */
function memberNamed(ctx: ViewerContext, userId: string) {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return Promise.resolve(null)
	const id = createHash("sha256")
		.update(
			JSON.stringify([
				userId,
				snapshot.version,
				[...ctx.ratings].sort((a, b) => a[0] - b[0]),
				[...ctx.seen].sort((a, b) => a - b),
				[...ctx.wishlist.keys()].sort((a, b) => a - b),
				[...ctx.skipped].sort((a, b) => a - b),
			]),
		)
		.digest("base64url")
	const now = Date.now()
	const hit = kept.get(id)
	if (hit && hit.until > now) return hit.named
	const named = loadTaste({ kind: "member", userId }).then((taste) =>
		namedSides(readPerson(snapshot, portraitInput("member", ctx, taste))),
	)
	kept.delete(id)
	kept.set(id, { until: now + KEEP_MS, named })
	named.catch(() => kept.delete(id))
	for (const [key, entry] of kept) {
		if (entry.until > now && kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return named
}

/** The side's loved titles closest to z, one per franchise, with posters. */
async function nearOf(side: SideDraft, z: ArrayLike<number>, n: number) {
	const closest = [...side.members]
		.filter((r) => r.facts.hasPoster)
		.sort((a, b) => cosine(b.z, z) - cosine(a.z, z) || a.key - b.key)
		.slice(0, NEAR_POOL)
	const displays = await titleDisplays(closest.map((r) => r.key))
	const franchises = new Set<string>()
	const near: TitleSidesSide["near"] = []
	for (const r of closest) {
		const display = displays.get(r.key)
		if (!display?.poster || near.length >= n) continue
		const franchise = franchiseOf(display.title)
		if (franchises.has(franchise)) continue
		franchises.add(franchise)
		near.push({
			mediaType: r.facts.mediaType,
			tmdbId: r.facts.tmdbId,
			title: display.title,
			poster: display.poster,
		})
	}
	return near
}

async function sideOf(
	named: NamedSides,
	index: number,
	z: ArrayLike<number>,
	n: number,
): Promise<TitleSidesSide> {
	const side = named.sides[index]
	return {
		number: index + 1,
		name: side.name,
		short: side.short,
		moods: sideMoods(side.members),
		near: await nearOf(side, z, n),
	}
}

/** Where the title sits in the signed-in member's Taste; null when the page says nothing about sides. */
export async function titleSides(
	request: Request,
	userId: string | null | undefined,
	mediaType: "movie" | "show",
	tmdbId: number,
): Promise<TitleSides | null> {
	if (!userId) return null
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const key = titleKey(mediaType, tmdbId)
	const z = titleZ(snapshot, key)
	const facts = snapshot.facts(key)
	if (!z || !facts) return null
	const who = await portraitViewer(request, undefined, userId)
	const context = who.context()
	const ctx = await context
	// Seen, rated, Not interested, dropped, or passed on: not a recommendation, so nothing about sides.
	if (!recommendable(ctx, key)) return null
	const named = await memberNamed(ctx, userId)
	if (!named) return null
	// The edges are the Taste page's: its view, from its cache when there.
	const place = await placeTitle(
		named,
		z,
		facts,
		async () => {
			const view = await getTastePortrait(
				{ ...who, context: () => context },
				"sides",
			)
			return view.status === "ready" ? view.sides : null
		},
		BARS,
	)
	if (!place) return null
	if (place.at === "on")
		return {
			at: "on",
			edge: null,
			edgeTail: null,
			side: await sideOf(named, place.side, z, NEAR),
			other: null,
		}
	const between = place.other !== null
	const [side, other] = await Promise.all([
		sideOf(named, place.side, z, between ? NEAR_BETWEEN : NEAR),
		place.other === null ? null : sideOf(named, place.other, z, NEAR_BETWEEN),
	])
	return {
		at: "edge",
		edge: between ? "between" : place.edge.kind === "step" ? "step" : "place",
		edgeTail: place.edge.tail,
		side,
		other,
	}
}

/**
 * titleSides within the page's budget, counted from `since`: past it, or on a failure, the page goes without the line
 * (the work goes on, so the next title page finds the member's sides kept).
 */
export async function titleSidesWithin(
	work: Promise<TitleSides | null>,
	since: number,
	budgetMs: number,
): Promise<TitleSides | null> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const late = new Promise<null>((resolve) => {
		timer = setTimeout(
			() => resolve(null),
			Math.max(0, since + budgetMs - Date.now()),
		)
	})
	try {
		return await Promise.race([
			work.catch((error) => {
				console.error("title sides", error)
				return null
			}),
			late,
		])
	} finally {
		clearTimeout(timer)
	}
}
