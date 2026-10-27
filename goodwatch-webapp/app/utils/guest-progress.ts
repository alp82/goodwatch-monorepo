import { captureProductEvent } from "~/telemetry/product-analytics"
import { canonicalTitleId } from "~/utils/title-identity"
import { GUEST_RATING_LIMIT } from "~/domain/taste-rules"
import { useSyncExternalStore } from "react"
import type { TasteInteraction } from "~/ui/taste/types"
import type { Score } from "~/server/scores.server"
import type { MediaType, UserData } from "~/types/user-data"
import {
	ONBOARDING_RATINGS_KEY,
	FIRST_UNLOCK_COUNT_KEY,
	TASTE_PROFILE_FEATURES_KEY,
} from "~/ui/taste/constants"

const changed = "goodwatch:guest-progress"
export const guestLimitEvent = "goodwatch:guest-rating-limit"
/** Where browsers remember dismissing the old "Keep your progress" strip (removed 2026-10-28); cleared at sign-up. */
export const reminderKey = "guest_progress_reminder_dismissed"
let fallback = "[]"
let memoryOnly = false
const empty: TasteInteraction[] = []
let lastRaw = ""
let cached = empty
export function normalizeGuestInteractions(
	parsed: unknown,
): TasteInteraction[] {
	const unique = new Map<string, TasteInteraction>()
	if (Array.isArray(parsed))
		for (const value of parsed) {
			if (
				!value ||
				!Number.isInteger(value.tmdb_id) ||
				value.tmdb_id <= 0 ||
				!["movie", "show"].includes(value.media_type)
			)
				continue
			value.tmdb_id = canonicalTitleId(value.media_type, value.tmdb_id)
			const type = value.type || (value.score ? "score" : undefined)
			if (
				!["score", "plan", "skip", "not-interested"].includes(type) ||
				(type === "score" &&
					(!Number.isInteger(value.score) ||
						value.score < 1 ||
						value.score > 10))
			)
				continue
			unique.set(`${value.media_type}-${value.tmdb_id}`, {
				...value,
				type,
				timestamp: Number(value.timestamp) || 0,
			})
		}
	return [...unique.values()]
}
export function readGuestInteractions(): TasteInteraction[] {
	if (typeof window === "undefined") return empty
	let raw = fallback
	try {
		if (!memoryOnly) raw = localStorage.getItem(ONBOARDING_RATINGS_KEY) || "[]"
	} catch {}
	if (raw === lastRaw) return cached
	lastRaw = raw
	try {
		const interactions = normalizeGuestInteractions(JSON.parse(raw))
		// No marks is the list the server rendered with, by identity: the first read in the browser then changes
		// nothing for a new visitor, where a new empty list rendered every title card again right after hydration.
		cached = interactions.length ? interactions : empty
	} catch {
		cached = empty
	}
	return cached
}
function subscribe(listener: () => void) {
	window.addEventListener(changed, listener)
	return () => window.removeEventListener(changed, listener)
}
export function useGuestInteractions() {
	return useSyncExternalStore(subscribe, readGuestInteractions, () => empty)
}
function write(interactions: TasteInteraction[]) {
	fallback = JSON.stringify(interactions)
	try {
		localStorage.setItem(ONBOARDING_RATINGS_KEY, fallback)
		memoryOnly = false
	} catch {
		memoryOnly = true
	}
	// Also retain an in-memory snapshot when storage is unavailable.
	lastRaw = fallback
	cached = interactions
	window.dispatchEvent(new Event(changed))
}
export function canGuestRate(mediaType: MediaType, tmdbId: number) {
	tmdbId = canonicalTitleId(mediaType, tmdbId)
	const items = readGuestInteractions()
	return (
		items.some(
			(i) =>
				i.media_type === mediaType &&
				i.tmdb_id === tmdbId &&
				i.type === "score",
		) || items.filter((i) => i.type === "score").length < GUEST_RATING_LIMIT
	)
}
export function updateGuestInteraction(
	mediaType: MediaType,
	tmdbId: number,
	type: TasteInteraction["type"],
	score?: Score | null,
	remove = false,
) {
	tmdbId = canonicalTitleId(mediaType, tmdbId)
	if (
		type === "score" &&
		!remove &&
		score !== null &&
		!canGuestRate(mediaType, tmdbId)
	) {
		window.dispatchEvent(new Event(guestLimitEvent))
		return false
	}
	const items = readGuestInteractions()
	const next = items.filter(
		(i) =>
			!(
				i.media_type === mediaType &&
				i.tmdb_id === tmdbId &&
				(!remove || i.type === type)
			),
	)
	if (!remove)
		next.push({
			media_type: mediaType,
			tmdb_id: tmdbId,
			type,
			...(type === "score" ? { score: score! } : {}),
			timestamp: Date.now(),
		})
	write(next)
	const before = items.find(
		(i) => i.media_type === mediaType && i.tmdb_id === tmdbId,
	)
	if (!remove && before && before.type !== type)
		captureGuestMark(before, true, "replacement")
	if (!remove || (before && before.type === type))
		captureGuestMark(
			{
				media_type: mediaType,
				tmdb_id: tmdbId,
				type,
				score: score ?? undefined,
				timestamp: Date.now(),
			},
			remove,
			"manual",
			before?.score,
		)

	return true
}
function captureGuestMark(
	item: TasteInteraction,
	remove: boolean,
	origin: string,
	previousScore?: Score,
) {
	const event =
		item.type === "score"
			? remove
				? "rating cleared"
				: "rating saved"
			: item.type === "plan"
				? remove
					? "want to see removed"
					: "want to see added"
				: item.type === "skip"
					? remove
						? "title unskipped"
						: "title skipped"
					: remove
						? "not interested removed"
						: "not interested added"
	captureProductEvent(event, {
		tmdb_id: item.tmdb_id,
		media_type: item.media_type,
		storage: "guest",
		origin,
		score:
			item.type === "score"
				? remove
					? null
					: (item.score ?? null)
				: undefined,
		previous_score: previousScore,
	})
}

/** A title's guest interactions as they are now, for putting them back later with restoreGuestInteractions. */
export function guestInteractionsOf(mediaType: MediaType, tmdbId: number) {
	tmdbId = canonicalTitleId(mediaType, tmdbId)
	return readGuestInteractions().filter(
		(i) => i.media_type === mediaType && i.tmdb_id === tmdbId,
	)
}
/** Undo: replaces a title's guest interactions with ones read earlier, timestamps included. */
export function restoreGuestInteractions(
	mediaType: MediaType,
	tmdbId: number,
	previous: TasteInteraction[],
) {
	tmdbId = canonicalTitleId(mediaType, tmdbId)
	const current = guestInteractionsOf(mediaType, tmdbId)
	write([
		...readGuestInteractions().filter(
			(i) => !(i.media_type === mediaType && i.tmdb_id === tmdbId),
		),
		...previous,
	])
	for (const item of current)
		if (!previous.some((p) => p.type === item.type))
			captureGuestMark(item, true, "undo")
	for (const item of previous)
		if (!current.some((c) => c.type === item.type && c.score === item.score))
			captureGuestMark(
				item,
				false,
				"undo",
				current.find((c) => c.type === "score")?.score,
			)
}
export function guestUserData(interactions: TasteInteraction[]): UserData {
	const data: UserData = {
		scores: {},
		wishlist: {},
		skipped: {},
		notInterested: {},
		// Tracking is for members: a guest has no watch state.
		watchState: {},
		favorites: {},
	}
	for (const item of interactions) {
		const key = `${item.media_type}-${item.tmdb_id}` as const
		const updatedAt = new Date(item.timestamp)
		if (item.type === "score")
			data.scores[key] = { score: item.score!, review: null, updatedAt }
		else if (item.type === "plan")
			data.wishlist[key] = { createdAt: updatedAt, updatedAt }
		else if (item.type === "not-interested")
			data.notInterested[key] = { updatedAt }
		else data.skipped[key] = { updatedAt }
	}
	return data
}
// Call only after a completed transfer/decline. Browser preferences and discovery stay intact.
export function clearGuestProgress() {
	write([])
	for (const key of [
		FIRST_UNLOCK_COUNT_KEY,
		TASTE_PROFILE_FEATURES_KEY,
		reminderKey,
	]) {
		try {
			localStorage.removeItem(key)
		} catch {}
	}
}
export function snapshotGuestProgress() {
	return {
		interactions: readGuestInteractions(),
		country: localStorage.getItem("country"),
		services: localStorage.getItem("withStreamingProviders"),
		discovery: localStorage.getItem("goodwatch_discovery"),
		taste: localStorage.getItem("taste_exploration"),
		search: localStorage.getItem("goodwatch_search"),
	}
}
