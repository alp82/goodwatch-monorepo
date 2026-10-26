import type { TitleMarksWritten } from "./mcp/title-marks.ts"
// Wishlist and Not interested changes for many titles of one member at once, for MCP batch writes: one multi-row
// statement per change (and per media type for a delete) and one member data reset, where the single-title writers
// in wishList.server.ts and not-interested.server.ts take several statements and a reset per title.
import { clearNotInterestedMany } from "~/server/not-interested-store.server"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { markTasteChanged } from "~/server/taste/index.server"
import { resetUserDataCache } from "~/server/userData.server"
import { execute, insertRows } from "~/utils/crate"
import { canonicalTitleId } from "~/utils/title-identity"
import { markPersonalOrderChanged } from "./personal-order/rebuild.server.ts"

export interface ManyTitles {
	tmdb_id: number
	media_type: "movie" | "show"
	/** Only for adding: the added-at time to give the title back, as `addedAt` of `updateWishList`. */
	addedAt?: Date
}

/** The titles once each, by canonical id, grouped by media type for an `IN` list. */
export function byMediaType(titles: readonly ManyTitles[]) {
	const seen = new Map<string, ManyTitles>()
	for (const title of titles) {
		const tmdb_id = canonicalTitleId(title.media_type, title.tmdb_id)
		seen.set(`${title.media_type}-${tmdb_id}`, { ...title, tmdb_id })
	}
	const unique = [...seen.values()]
	return {
		unique,
		groups: (["movie", "show"] as const)
			.map((media_type) => ({
				media_type,
				ids: unique
					.filter((t) => t.media_type === media_type)
					.map((t) => t.tmdb_id),
			}))
			.filter((group) => group.ids.length > 0),
	}
}

/**
 * `updateWishList` for many titles of one member at once: one multi-row statement per change (and per media type
 * for a removal) and one member data reset, where the single writer takes four statements and a reset per title.
 * The rules are the single writer's: adding never moves a stored row and takes the title off Not interested.
 * Adding a show through MCP still goes through the show's tracking first (see the MCP batch writer).
 */
export const updateWishListMany = async ({
	user_id,
	titles,
	action,
}: {
	user_id: string
	titles: readonly ManyTitles[]
	action: "add" | "remove"
}): Promise<{ rowcount: number; written?: TitleMarksWritten }> => {
	const { unique, groups } = byMediaType(titles)
	if (!user_id || !unique.length) return { rowcount: 0 }
	let rowcount = 0
	const now = new Date()
	try {
		if (action === "add") {
			rowcount = (
				await insertRows(
					"user_wishlist",
					["user_id", "tmdb_id", "media_type", "created_at", "updated_at"],
					unique.map((t) => [
						user_id,
						t.tmdb_id,
						t.media_type,
						t.addedAt ?? now,
						now,
					]),
					{ conflict: ["user_id", "tmdb_id", "media_type"] },
				)
			).rowcount
		} else {
			for (const group of groups)
				rowcount +=
					(
						await execute(
							`DELETE FROM user_wishlist WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${group.ids.map(() => "?").join(", ")})`,
							[user_id, group.media_type, ...group.ids],
						)
					).rowcount || 0
		}
		if (rowcount) markPersonalOrderChanged(user_id)
		if (action === "add") await clearNotInterestedMany(user_id, unique)
	} finally {
		// Also after a failed statement: earlier statements may have landed.
		await resetUserDataCache({ user_id })
		if (rowcount) await markTasteChanged(user_id)
		await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })
	}
	return {
		rowcount,
		written: {
			want_to_see: {
				value: action === "add",
				updatedAt: action === "add" ? now.toISOString() : null,
			},
			...(action === "add"
				? { not_interested: { value: false, updatedAt: null } }
				: {}),
		},
	}
}

/**
 * `updateNotInterested` for many titles of one member at once: one multi-row statement per change and media type,
 * and one member data reset. The rules are the single writer's: setting it takes the titles off the Wishlist.
 * Callers check first that each title is unseen and unrated, as the single path does.
 */
export const updateNotInterestedMany = async ({
	user_id,
	titles,
	action,
}: {
	user_id: string
	titles: readonly ManyTitles[]
	action: "add" | "remove"
}): Promise<{ rowcount: number; written?: TitleMarksWritten }> => {
	const { unique, groups } = byMediaType(titles)
	if (!user_id || !unique.length) return { rowcount: 0 }
	const inList = (ids: number[]) => ids.map(() => "?").join(", ")
	let rowcount = 0
	const now = new Date()
	try {
		if (action === "add") {
			rowcount = (
				await insertRows(
					"user_not_interested",
					["user_id", "tmdb_id", "media_type", "created_at", "updated_at"],
					unique.map((t) => [user_id, t.tmdb_id, t.media_type, now, now]),
					{ conflict: ["user_id", "tmdb_id", "media_type"] },
				)
			).rowcount
			let removed = 0
			for (const group of groups)
				removed +=
					(
						await execute(
							`DELETE FROM user_wishlist WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${inList(group.ids)})`,
							[user_id, group.media_type, ...group.ids],
						)
					).rowcount || 0
			// Removing Want to See changes taste; the hide itself is never a taste signal.
			if (removed) await markTasteChanged(user_id)
			if (rowcount || removed) markPersonalOrderChanged(user_id)
		} else {
			for (const group of groups)
				rowcount +=
					(
						await execute(
							`DELETE FROM user_not_interested WHERE user_id = ? AND media_type = ? AND tmdb_id IN (${inList(group.ids)})`,
							[user_id, group.media_type, ...group.ids],
						)
					).rowcount || 0
			if (rowcount) markPersonalOrderChanged(user_id)
		}
	} finally {
		await resetUserDataCache({ user_id })
		await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })
	}
	return {
		rowcount,
		written: {
			not_interested: {
				value: action === "add",
				updatedAt: action === "add" ? now.toISOString() : null,
			},
			...(action === "add"
				? { want_to_see: { value: false, updatedAt: null } }
				: {}),
		},
	}
}
