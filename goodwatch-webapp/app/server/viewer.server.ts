import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import type { TasteInteraction } from "~/ui/taste/types"
import { getUserIdFromRequest } from "~/utils/auth"
import { normalizeGuestInteractions } from "~/utils/guest-progress"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import { type TitleKey, titleKey } from "~/utils/title-key"

// What a guest's browser sends to guest-aware endpoints: the guest progress (ratings, Want to See, skipped) and the
// country and services the guest chose, as `snapshotGuestProgress` in `utils/guest-progress.ts` collects them.
export interface GuestProgress {
	interactions: TasteInteraction[]
	country?: string | null
	services?: string | number[] | null // comma-separated ids, as the browser stores them, or a list
}

export type Viewer =
	| { kind: "member"; userId: string }
	| { kind: "guest"; progress: GuestProgress }

export interface ViewerContext {
	viewer: Viewer
	country: string
	services: number[] // saved, expanded through duplicateProviderMapping; [] for none
	seen: ReadonlySet<TitleKey> // scored or watched
	ratings: ReadonlyMap<TitleKey, number> // the person's scores, 1 to 10
	wishlist: ReadonlyMap<TitleKey, Date> // added-at
	skipped: ReadonlySet<TitleKey> // Passed in the taste quiz
	notInterested: ReadonlySet<TitleKey> // Always hidden from recommendations
	forYou: boolean // the member's saved For you setting; true for guests
}

/**
 * Everything the recommendation surfaces need to know about the person: one call in place of separate reads of user
 * data and settings. A signed-in member is read from Crate; anyone else is a guest, described by the guest progress
 * their browser sent (or none).
 */
export async function getViewerContext(
	request: Request,
	guest?: GuestProgress,
	// The signed-in member's id when the caller has already read it (null for a guest), to skip a second auth check.
	knownUserId?: string | null,
): Promise<ViewerContext> {
	const userId =
		knownUserId === undefined
			? await getUserIdFromRequest({ request })
			: knownUserId
	const guessedCountry = getLocaleFromRequest(request).locale.country
	if (!userId) return guestContext(guest, guessedCountry)
	return getMemberViewerContext(userId, guessedCountry)
}

/** A member's viewer context by user id, for callers that already know the member (and scripts). */
export async function getMemberViewerContext(
	userId: string,
	guessedCountry: string,
): Promise<ViewerContext> {
	const [userData, settings] = await Promise.all([
		getUserData({ user_id: userId }),
		getUserSettings({ userId }),
	])
	const ratings = new Map<TitleKey, number>()
	for (const [key, entry] of Object.entries(userData.scores)) {
		if (entry.score) ratings.set(toTitleKey(key as MediaKey), entry.score)
	}
	const wishlist = new Map<TitleKey, Date>()
	for (const [key, entry] of Object.entries(userData.wishlist)) {
		wishlist.set(toTitleKey(key as MediaKey), new Date(entry.createdAt))
	}
	return {
		viewer: { kind: "member", userId },
		country: countryCode(settings.country_default) ?? guessedCountry,
		services: expandServices(settings.streaming_providers_default),
		seen: new Set([
			...Object.keys(userData.scores).map((key) => toTitleKey(key as MediaKey)),
			...Object.keys(userData.watched).map((key) =>
				toTitleKey(key as MediaKey),
			),
		]),
		ratings,
		wishlist,
		skipped: new Set(
			Object.keys(userData.skipped).map((key) => toTitleKey(key as MediaKey)),
		),
		notInterested: new Set(Object.keys(userData.notInterested).map((key) => toTitleKey(key as MediaKey))),
		forYou: settings.for_you !== "no",
	}
}

function guestContext(
	guest: GuestProgress | undefined,
	guessedCountry: string,
): ViewerContext {
	const interactions = normalizeGuestInteractions(guest?.interactions ?? [])
	const seen = new Set<TitleKey>()
	const ratings = new Map<TitleKey, number>()
	const wishlist = new Map<TitleKey, Date>()
	const skipped = new Set<TitleKey>()
	const notInterested = new Set<TitleKey>()
	for (const item of interactions) {
		const key = titleKey(item.media_type, item.tmdb_id)
		if (item.type === "score") {
			seen.add(key)
			if (item.score) ratings.set(key, item.score)
		} else if (item.type === "plan") wishlist.set(key, new Date(item.timestamp))
		else if (item.type === "not-interested") notInterested.add(key)
		else skipped.add(key)
	}
	return {
		viewer: {
			kind: "guest",
			progress: {
				interactions,
				country: guest?.country ?? null,
				services: guest?.services ?? null,
			},
		},
		country: countryCode(guest?.country) ?? guessedCountry,
		services: expandServices(guest?.services),
		seen,
		ratings,
		wishlist,
		skipped,
		notInterested,
		forYou: true,
	}
}

const toTitleKey = (key: MediaKey): TitleKey => {
	const { mediaType, tmdbId } = parseMediaKey(key)
	return titleKey(mediaType, tmdbId)
}

const countryCode = (value: string | null | undefined) => {
	const code = value?.trim().toUpperCase()
	return code && /^[A-Z]{2}$/.test(code) ? code : null
}

// A saved service stands for its duplicates too (Amazon Prime Video for Amazon Video and Prime Video).
function expandServices(value: string | number[] | null | undefined): number[] {
	const ids = (Array.isArray(value) ? value : (value ?? "").split(","))
		.map((id) => Number(id))
		.filter((id) => Number.isSafeInteger(id) && id > 0)
	return [
		...new Set(
			ids.flatMap((id) => [id, ...(duplicateProviderMapping[id] ?? [])]),
		),
	]
}
