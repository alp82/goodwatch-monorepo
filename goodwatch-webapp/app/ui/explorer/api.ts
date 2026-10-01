// The Explorer's reads from `/api/explorer/*`: members send GET and are read from their session; guests send POST
// with the guest progress their browser holds, so taste, Seen, and their services apply to them too.
import type {
	ExplorerBridge,
	ExplorerCard,
	ExplorerIslandTree,
	ExplorerMap,
	ExplorerPairs,
	Grouping,
	TitleType,
} from "~/domain/explorer"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import type { TitleKey } from "~/utils/title-key"

/** The map's query as the URL holds it: the grouping and the filters (null is the default). */
export interface MapQuery {
	grouping: Grouping
	/** "mine" or "all"; by default On my services is on when the viewer has services. */
	services: "mine" | "all" | null
	/** "0" turns Not seen yet off; it's on by default. */
	unseen: "0" | "1" | null
	/** Only movies, shows, or anime; every type by default. */
	type: Exclude<TitleType, "all"> | null
}

export class ExplorerRequestFailed extends Error {
	constructor(readonly status: number) {
		super(`Explorer request failed with ${status}`)
		this.name = "ExplorerRequestFailed"
	}
}

async function request<T>(
	endpoint: string,
	params: Record<string, string | null>,
	member: boolean,
): Promise<T> {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(params))
		if (value != null) query.set(key, value)
	const url = `/api/explorer/${endpoint}?${query}`
	let response: Response
	if (member) response = await fetch(url)
	else {
		const { interactions, country, services } = snapshotGuestProgress()
		response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ guest: { interactions, country, services } }),
		})
	}
	if (!response.ok) throw new ExplorerRequestFailed(response.status)
	return (await response.json()) as T
}

const mapParams = (q: MapQuery) => ({
	grouping: q.grouping,
	services: q.services,
	unseen: q.unseen,
	type: q.type,
})

export const fetchMap = (q: MapQuery, member: boolean) =>
	request<ExplorerMap>("map", mapParams(q), member)

export const fetchIsland = (q: MapQuery, id: string, member: boolean) =>
	request<ExplorerIslandTree>("island", { ...mapParams(q), id }, member)

export const fetchCard = (key: TitleKey, member: boolean) =>
	request<ExplorerCard>("card", { key: String(key) }, member)

export const fetchPairs = (q: MapQuery, member: boolean) =>
	request<ExplorerPairs>("pairs", mapParams(q), member)

export const fetchBridge = (
	q: MapQuery,
	a: string,
	b: string,
	member: boolean,
) => request<ExplorerBridge>("bridge", { ...mapParams(q), a, b }, member)

/** A pair of islands in one order, whichever way round they were picked. */
export const pairKey = (a: string, b: string) =>
	a < b ? `${a},${b}` : `${b},${a}`

/** Query keys: per viewer (a member's id, or "guest"), so signing in or out never shows another person's map. */
export const explorerKeys = {
	map: (viewer: string, q: MapQuery) =>
		[
			"explorer",
			"map",
			viewer,
			q.grouping,
			q.services,
			q.unseen,
			q.type,
		] as const,
	island: (viewer: string, q: MapQuery, id: string) =>
		[
			"explorer",
			"island",
			viewer,
			q.grouping,
			q.services,
			q.unseen,
			q.type,
			id,
		] as const,
	card: (viewer: string, key: TitleKey) =>
		["explorer", "card", viewer, key] as const,
	pairs: (viewer: string, q: MapQuery) =>
		[
			"explorer",
			"pairs",
			viewer,
			q.grouping,
			q.services,
			q.unseen,
			q.type,
		] as const,
	bridge: (viewer: string, q: MapQuery, a: string, b: string) =>
		[
			"explorer",
			"bridge",
			viewer,
			q.grouping,
			q.services,
			q.unseen,
			q.type,
			pairKey(a, b),
		] as const,
}
