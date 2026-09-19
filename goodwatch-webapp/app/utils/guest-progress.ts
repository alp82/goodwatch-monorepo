import { canonicalTitleId } from "~/utils/title-identity"
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
export const reminderKey = "guest_progress_reminder_dismissed"
let fallback = "[]"
let memoryOnly = false
const empty: TasteInteraction[] = []
let lastRaw = ""
let cached = empty
export function normalizeGuestInteractions(parsed: unknown): TasteInteraction[] {
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
				!["score", "plan", "skip"].includes(type) ||
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
		const parsed = JSON.parse(raw)
		cached = normalizeGuestInteractions(parsed)
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
		) || items.filter((i) => i.type === "score").length < 20
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
	return true
}
export function guestUserData(interactions: TasteInteraction[]): UserData {
	const data: UserData = {
		scores: {},
		wishlist: {},
		skipped: {},
		watched: {},
		favorites: {},
	}
	for (const item of interactions) {
		const key = `${item.media_type}-${item.tmdb_id}` as const
		const updatedAt = new Date(item.timestamp)
		if (item.type === "score")
			data.scores[key] = { score: item.score!, review: null, updatedAt }
		else
			data[item.type === "plan" ? "wishlist" : "skipped"][key] = { updatedAt }
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
