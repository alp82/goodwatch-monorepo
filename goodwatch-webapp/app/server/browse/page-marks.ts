// A title card's own marks (seen, Wishlist, Not interested) on a page's data: taken off for the copy every viewer
// shares (page-cache.server.ts), put back for one viewer. Pure: works on plain data (objects, arrays, scalars).
import type { ViewerContext } from "~/server/viewer.server"

type Marked = { key: number; seen: boolean; wantToSee: boolean; notInterested: boolean }
const isCard = (value: object): value is Marked =>
	typeof (value as Marked).key === "number" && typeof (value as Marked).seen === "boolean"

/** A deep copy of `value` with every title card's own marks set by `mark` (pure data: objects, arrays, scalars). */
function remark<T>(value: T, mark: (card: Marked) => void): T {
	const walk = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(walk)
		if (!v || typeof v !== "object") return v
		const out: Record<string, unknown> = {}
		for (const [k, x] of Object.entries(v)) out[k] = walk(x)
		if (isCard(out)) mark(out)
		return out
	}
	return walk(value) as T
}

export const unmarked = <T>(value: T): T =>
	remark(value, (c) => {
		c.seen = false
		c.wantToSee = false
		c.notInterested = false
	})

export const markedFor = <T>(
	value: T,
	ctx: Pick<ViewerContext, "seen" | "wishlist" | "notInterested">,
): T =>
	remark(value, (c) => {
		c.seen = ctx.seen.has(c.key)
		c.wantToSee = ctx.wishlist.has(c.key)
		c.notInterested = ctx.notInterested.has(c.key)
	})
