// PROTOTYPE - throwaway (#657). Reads one member's Person the way the Taste page does, read-only, kept in process for
// 10 minutes per member, plus their personal order when one is published (members in the personal order group only).
import { orderPersonalOrder, loadPersonalOrder } from "~/server/personal-order/reader.server"
import { readPerson, type Person, type PortraitInput } from "~/server/taste-portrait/person.server"
import { loadTaste } from "~/server/taste/index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"

export interface ProtoPerson {
	person: Person
	/** Orders unseen titles by personal order when the member has a payload; otherwise keeps the given order. */
	order(keys: TitleKey[]): TitleKey[]
	personalOrder: boolean
	personalOrderNote: string | null
}

const kept = new Map<string, { at: number; value: Promise<ProtoPerson | null> }>()

export function protoPerson(userId: string): Promise<ProtoPerson | null> {
	if (!getTitleSnapshot()) return Promise.resolve(null)
	const hit = kept.get(userId)
	if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value
	const value = build(userId)
	kept.set(userId, { at: Date.now(), value })
	value.catch(() => kept.delete(userId))
	return value
}

async function build(userId: string): Promise<ProtoPerson | null> {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const ctx = await getMemberViewerContext(userId, "US")
	const taste = await loadTaste({ kind: "member", userId })
	const input: PortraitInput = {
		kind: "member",
		scores: ctx.ratings,
		chosen: ctx.seen,
		wantToSee: new Set(ctx.wishlist.keys()),
		skipped: ctx.skipped,
		notInterested: ctx.hidden,
		country: ctx.country,
		services: ctx.services,
		taste,
	}
	const person = readPerson(snapshot, input)
	const read = await loadPersonalOrder(userId, snapshot).catch(() => ({ data: null, fallbackReason: "error" }))
	const data = read.data
	return {
		person,
		personalOrder: data !== null,
		personalOrderNote: read.fallbackReason,
		order: (keys) => {
			if (!data || !keys.length) return keys
			return orderPersonalOrder(keys, data, snapshot, false).keys as TitleKey[]
		},
	}
}
