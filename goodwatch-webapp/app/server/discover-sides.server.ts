// A member's taste groups (the Taste page's sides) and each title's group, for Watch next's taste picker
// (watch-next-taste-picker.server.ts) and Discover's taste panel (discover-panel.server.ts).
//
// The sides are the Taste page's (taste-portrait/sides.server.ts), and a title belongs to a side by the same rule as
// a loved title: its nearest side, when at least 0.3 close to its center and the side's name describes it. A side
// shows as its trait name with the loved titles that stand for it.
//
// Per member, the sides and each title's side are kept in process memory for 10 minutes, keyed by everything the
// grouping reads (ratings, seen, Want to See, skipped) and the snapshot version.
import { createHash } from "node:crypto"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { portraitInput } from "~/server/taste-portrait/index.server"
import { readPerson, titleZ } from "~/server/taste-portrait/person.server"
import {
	type NamedSides,
	franchiseOf,
	namedSides,
	sideHere,
	sideOfTitle,
} from "~/server/taste-portrait/sides.server"
import type { Taste } from "~/server/taste/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"

/** The loved titles that stand for a side in its header. */
const HERE = 4
const KEEP_MS = 10 * 60_000
// Each member kept holds one byte per snapshot title (about 250 KB at 250,000 titles).
const MAX_KEPT = 100

/** A side as the taste picker and panel show it. */
export interface MemberSide {
	/** The side's trait name ("Bleak, tense stories"). */
	name: string
	/** The loved titles that stand for the side, with their posters. */
	here: { key: TitleKey; title: string; poster: string }[]
}

/** A member's sides with what the picker and panel need of them, and each title's side once asked. */
export interface MemberSides {
	named: NamedSides
	sides: MemberSide[]
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
	const sides = named.sides.map((side, i): MemberSide => {
		// One title per franchise: a franchise's posters read alike.
		const franchises = new Set<string>()
		const shown: MemberSide["here"] = []
		for (const key of here[i]) {
			const display = displays.get(key)
			if (!display?.poster || shown.length >= HERE) continue
			const franchise = franchiseOf(display.title)
			if (franchises.has(franchise)) continue
			franchises.add(franchise)
			shown.push({ key, title: display.title, poster: display.poster })
		}
		return { name: side.name, here: shown }
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
