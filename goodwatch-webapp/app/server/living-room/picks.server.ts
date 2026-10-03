import type { LivingRoomPicks } from "~/domain/living-room"
import { isMoodKey } from "~/domain/moods"
import { rankStep } from "~/domain/taste-match"
import {
	countryServices,
	isOnServices,
} from "~/server/availability-index.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import { getTitleCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { Night } from "~/ui/living-room/tv-flow"
import { livingRoomServices } from "./data.server"

export class LivingRoomUnavailable extends Error {}

/**
 * What the living room orders a title by under For you: its percentile in the person's range, in the 50 even steps
 * these orders have always gone by, so titles within a step go by popularity. 0 without a taste match.
 */
export function rankOf(taste: Taste, key: number): number {
	const percentile = taste.percentile([key])[0]
	return percentile === null ? 0 : rankStep(percentile)
}

/** Select afresh from the shared Redis title snapshot; no cached rankings or picks. */
export async function getLivingRoomPicks(
	viewer: ViewerContext,
	night: Night,
): Promise<LivingRoomPicks> {
	const snapshot = getTitleSnapshot()
	if (!snapshot)
		throw new LivingRoomUnavailable("The title snapshot is loading")
	const taste = await loadTaste(viewer.viewer)
	let services = viewer.services
	if (night.service) {
		const offered = await livingRoomServices(viewer.country, viewer.services)
		const service = offered.find(({ name }) => name === night.service)
		if (!service)
			throw new RangeError("Unknown streaming service for this country")
		services = [service.id]
	}
	if (services.length && !countryServices(viewer.country))
		throw new LivingRoomUnavailable("Streaming availability is loading")
	const mood = night.mood && isMoodKey(night.mood) ? night.mood : null
	const today = Math.floor(Date.now() / 86_400_000)
	const candidates = (wishlist: boolean) => {
		const ranked: { key: number; rank: number; popularity: number }[] = []
		const consider = (key: number) => {
			if (viewer.seen.has(key) || viewer.skipped.has(key)) return
			if (!wishlist && viewer.wishlist.has(key)) return
			const facts = snapshot.facts(key)
			if (!facts || facts.adult || !facts.hasPoster) return
			if (facts.releaseDay !== null && facts.releaseDay > today) return
			if (mood && !facts.moods.includes(mood)) return
			if (
				services.length &&
				isOnServices(viewer.country, services, key) !== true
			)
				return
			if (!wishlist && ((facts.score ?? 0) < 70 || facts.votes < 1000)) return
			const fallback = wishlist
				? (viewer.wishlist.get(key)?.getTime() ?? 0)
				: facts.popularity
			const rank =
				viewer.forYou && taste.signal === "some" ? rankOf(taste, key) : fallback
			const entry = { key, rank, popularity: facts.popularity }
			// Retain extras because card hydration can omit deleted catalog entries.
			const at = ranked.findIndex(
				(other) =>
					rank > other.rank ||
					(rank === other.rank &&
						(entry.popularity > other.popularity ||
							(entry.popularity === other.popularity && key < other.key))),
			)
			if (at >= 0) ranked.splice(at, 0, entry)
			else if (ranked.length < 12) ranked.push(entry)
			if (ranked.length > 12) ranked.pop()
		}
		if (wishlist) for (const key of viewer.wishlist.keys()) consider(key)
		else snapshot.forEach(consider)
		return ranked.map(({ key }) => key)
	}
	const member = viewer.viewer.kind === "member"
	const wishlist = member && night.source !== "new" ? candidates(true) : []
	const source =
		night.source === "wishlist" ||
		(night.source === "auto" && wishlist.length > 0)
			? "wishlist"
			: "new"
	const keys = source === "wishlist" ? wishlist : candidates(false)
	if (!keys.length) return { titles: [], pickKeys: [], source }
	const titles = (await getTitleCards(keys, viewer, taste))
		.slice(0, 3)
		.map((card) => ({ ...card, moods: snapshot.facts(card.key)?.moods ?? [] }))
	return { titles, pickKeys: titles.map(({ key }) => String(key)), source }
}
