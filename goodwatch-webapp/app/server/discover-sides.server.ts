// Sides of you on Discover (#671, decided in #658): under Best match, a signed-in member's list as a row per side,
// plus a row of the titles that fit no side ("More for you"). Rows sit where their first title sits in the list and
// keep the list's order inside, so personal order decides both: sides group, personal order ranks. A side's "See all"
// narrows the list to that side's titles (`side=<id>`, or `side=none`), still in the list's order.
//
// The sides are the Taste page's (taste-portrait/sides.server.ts), and a title belongs to a side by the same rule as
// a loved title: its nearest side, when at least 0.3 close to its center and the side's name describes it.
//
// Words gate (#656): a side shows as "Side N" with the loved titles that stand for it, and no summary line. Its name
// reaches Discover only with DISCOVER_SIDE_NAMES=on, which stays off until the gate passes.
//
// Per member, the sides and each title's side are kept in process memory for 10 minutes, keyed by everything the
// grouping reads (ratings, seen, Want to See, skipped) and the snapshot version.
import { createHash } from "node:crypto"
import type { MoodKey } from "~/domain/moods"
import { discoverSideNames } from "~/server/features.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { portraitInput } from "~/server/taste-portrait/index.server"
import { readPerson, titleZ } from "~/server/taste-portrait/person.server"
import {
	type NamedSides,
	franchiseOf,
	namedSides,
	sideHere,
	sideMoods,
	sideOfTitle,
} from "~/server/taste-portrait/sides.server"
import type { Taste } from "~/server/taste/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"

/** The id of the titles that fit no side, in `side=` and in a row's id. */
export const NO_SIDE = "none"
/** The titles a row shows; "See all" opens the rest. */
export const ROW_TITLES = 12
/** The loved titles that stand for a side in its header. */
const HERE = 4
const KEEP_MS = 10 * 60_000
// Each member kept holds one byte per snapshot title (about 250 KB at 250,000 titles).
const MAX_KEPT = 100

/** A side as Discover shows it, or (id "none") the titles that fit no side. */
export interface DiscoverSide {
	/** "side-1", "side-2", and so on as on the Taste page; "none" for the titles that fit no side. */
	id: string
	/** "Side 2"; null for the titles that fit no side. */
	number: number | null
	/** The side's name, only while the side names switch is on (the words gate, #656). */
	name: string | null
	/** Its titles in this list. */
	total: number
	/** The moods Watch next opens the side with. */
	moods: MoodKey[]
	/** The loved titles that stand for the side, with their posters. */
	here: { key: TitleKey; title: string; poster: string }[]
}

/** A member's sides with what Discover needs of them, and each title's side once asked. */
export interface MemberSides {
	named: NamedSides
	sides: Omit<DiscoverSide, "total">[]
	/** The side of the title at each snapshot row: -2 not worked out yet, -1 no side, else the side's index. */
	fits: Int8Array
	snapshot: TitleSnapshot
}

const kept = new Map<
	string,
	{ until: number; sides: Promise<MemberSides | null> }
>()

/** The member's sides, or null when they have fewer than two (or are a guest). */
export function memberSides(
	ctx: ViewerContext,
	taste: Taste,
	snapshot: TitleSnapshot,
): Promise<MemberSides | null> {
	if (ctx.viewer.kind !== "member") return Promise.resolve(null)
	const id = createHash("sha256")
		.update(
			JSON.stringify([
				ctx.viewer.userId,
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
	if (hit && hit.until > now) return hit.sides
	const sides = build(ctx, taste, snapshot)
	kept.delete(id)
	kept.set(id, { until: now + KEEP_MS, sides })
	sides.catch(() => kept.delete(id))
	for (const [key, entry] of kept) {
		if (entry.until > now && kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return sides
}

async function build(
	ctx: ViewerContext,
	taste: Taste,
	snapshot: TitleSnapshot,
): Promise<MemberSides | null> {
	const person = readPerson(snapshot, portraitInput("member", ctx, taste))
	const named = namedSides(person)
	if (!named) return null
	const here = named.sides.map((side) => sideHere(person, side))
	const displays = await titleDisplays(new Set(here.flat()))
	const names = discoverSideNames()
	const sides = named.sides.map((side, i) => {
		// One title per franchise: a franchise's posters read alike.
		const franchises = new Set<string>()
		const shown: DiscoverSide["here"] = []
		for (const key of here[i]) {
			const display = displays.get(key)
			if (!display?.poster || shown.length >= HERE) continue
			const franchise = franchiseOf(display.title)
			if (franchises.has(franchise)) continue
			franchises.add(franchise)
			shown.push({ key, title: display.title, poster: display.poster })
		}
		return {
			id: side.id,
			number: i + 1,
			name: names ? side.name : null,
			moods: sideMoods(side.members),
			here: shown,
		}
	})
	return {
		named,
		sides,
		fits: new Int8Array(snapshot.count).fill(-2),
		snapshot,
	}
}

/** The side a title of the list belongs to (its index), or null when it fits none. */
export function sideOf(member: MemberSides, key: TitleKey): number | null {
	const row = member.snapshot.rowOf(key)
	if (row < 0) return null
	if (member.fits[row] === -2) {
		const z = titleZ(member.snapshot, key)
		const facts = member.snapshot.factsAt(row)
		const side = z ? sideOfTitle(member.named, { z, facts }) : null
		member.fits[row] = side ?? -1
	}
	const side = member.fits[row]
	return side < 0 ? null : side
}

/** The side `side=` names: its index, null for the titles that fit no side, undefined when it names none. */
export function requestedGroup(
	member: MemberSides,
	id: string | null | undefined,
): number | null | undefined {
	if (!id) return undefined
	if (id === NO_SIDE) return null
	const index = member.sides.findIndex((side) => side.id === id)
	return index < 0 ? undefined : index
}

/** A group as Discover shows it. */
export function discoverSide(
	member: MemberSides,
	side: number | null,
	total: number,
): DiscoverSide {
	if (side === null)
		return {
			id: NO_SIDE,
			number: null,
			name: null,
			total,
			moods: [],
			here: [],
		}
	return { ...member.sides[side], total }
}
