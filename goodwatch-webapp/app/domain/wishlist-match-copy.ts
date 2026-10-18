// What a member reads when matching wishlist titles by hand fails. The server answers with `{ error, code }`; the
// error text comes from this map, so the client and the server never disagree on wording. No string here promises
// that GoodWatch supports a streaming service.
import type { WishlistMatchErrorCode } from "./imports.ts"

export const WISHLIST_MATCH_ERROR_MESSAGES = {
	wishlist_preview_required:
		"This preview can't change anymore, because it was imported or is no longer a preview. To match titles, choose the file again.",
	wishlist_snapshot_required:
		"This preview was made before you could match titles yourself. To match them, choose the file again.",
	wishlist_resolution_invalid:
		"GoodWatch couldn't read your matches. Try again.",
	wishlist_row_not_resolvable:
		"One of these titles can't be matched in this preview. To start over, choose the file again.",
	wishlist_source_choice_conflict:
		"Two entries for the same title in your file got different matches. Give them the same match, then try again.",
	wishlist_target_missing:
		"A title you chose isn't in the GoodWatch catalog anymore. Search again and choose another match.",
	wishlist_search_invalid: "Type 2 to 100 characters to search.",
	wishlist_search_unavailable:
		"Search isn't working right now. Try again in a moment.",
	wishlist_body_too_large:
		"That's too many changes at once. Update the preview with fewer matches, then add the rest.",
	method_not_allowed: "Something went wrong on our side. Try again.",
} as const satisfies Record<WishlistMatchErrorCode, string>

/** The member's message for a code, or null for a code this module doesn't know. */
export function wishlistMatchErrorMessage(code: string): string | null {
	return Object.prototype.hasOwnProperty.call(
		WISHLIST_MATCH_ERROR_MESSAGES,
		code,
	)
		? WISHLIST_MATCH_ERROR_MESSAGES[code as WishlistMatchErrorCode]
		: null
}

/** Codes after which this preview can't take matches, so the member starts again from the file. */
export const WISHLIST_MATCH_RESTART_CODES: readonly WishlistMatchErrorCode[] = [
	"wishlist_preview_required",
	"wishlist_snapshot_required",
	"wishlist_row_not_resolvable",
]
