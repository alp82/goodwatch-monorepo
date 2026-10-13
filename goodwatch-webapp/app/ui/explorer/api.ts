// The Explorer's reads from `/api/explorer/*`: members send GET and are read from their session; guests send POST
// with the guest progress their browser holds, so taste, Seen, and their services apply to them too.
import type {
	ExplorerCard,
	ExplorerIslandTree,
	ExplorerMap,
	ExplorerCombination,
	ExplorerParts,
	ExplorerShares,
	ExplorerWorld,
	Grouping,
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
	/** Only movies or shows; every format by default. */
	type: "movie" | "show" | null
	/** Only anime, or none of it; with anime by default. */
	anime: "only" | "none" | null
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
	anime: q.anime,
})

export const fetchMap = (q: MapQuery, member: boolean) =>
	request<ExplorerMap>("map", mapParams(q), member)

export const fetchIsland = (q: MapQuery, id: string, member: boolean) =>
	request<ExplorerIslandTree>("island", { ...mapParams(q), id }, member)

export const fetchCard = (key: TitleKey, member: boolean) =>
	request<ExplorerCard>("card", { key: String(key) }, member)

/** The map's filters as the URL holds them (null is the default): the world has every grouping. */
export type WorldQuery = Omit<MapQuery, "grouping">

const worldParams = (q: WorldQuery) => ({
	services: q.services,
	unseen: q.unseen,
	type: q.type,
	anime: q.anime,
})

export const fetchWorld = (q: WorldQuery, member: boolean) =>
	request<ExplorerWorld>("world", worldParams(q), member)

/** `of` holds the picked islands' ids in the world ("mood:funny"), in the order picked. */
export const fetchCombination = (
	q: WorldQuery,
	of: readonly string[],
	member: boolean,
) =>
	request<ExplorerCombination>(
		"combination",
		{ ...worldParams(q), of: of.join(",") },
		member,
	)

export const fetchShares = (
	q: WorldQuery,
	of: readonly string[],
	member: boolean,
) =>
	request<ExplorerShares>(
		"shares",
		{ ...worldParams(q), of: of.join(",") },
		member,
	)

export const fetchParts = (
	q: WorldQuery,
	of: readonly string[],
	member: boolean,
) =>
	request<ExplorerParts>(
		"parts",
		{ ...worldParams(q), of: of.join(",") },
		member,
	)

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
			q.anime,
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
			q.anime,
			id,
		] as const,
	card: (viewer: string, key: TitleKey) =>
		["explorer", "card", viewer, key] as const,
	world: (viewer: string, q: WorldQuery) =>
		[
			"explorer",
			"world",
			viewer,
			q.services,
			q.unseen,
			q.type,
			q.anime,
		] as const,
	/** A read about picked islands: "combination", "shares", or "parts". */
	picked: (
		kind: "combination" | "shares" | "parts",
		viewer: string,
		q: WorldQuery,
		of: readonly string[],
	) =>
		[
			"explorer",
			kind,
			viewer,
			q.services,
			q.unseen,
			q.type,
			q.anime,
			of.join(","),
		] as const,
}
