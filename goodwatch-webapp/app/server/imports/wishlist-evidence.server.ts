import type { WishlistOriginalObservation } from "../../domain/imports.ts"

/** Native identity is scoped to this source/profile; title text never groups wishes. */
export function wishlistSourceGroup(
	original: WishlistOriginalObservation,
	index: number,
): string {
	const evidence = original.wishlistEvidence
	return evidence.sourceId
		? JSON.stringify([
				evidence.source,
				evidence.profileLabel ?? null,
				evidence.sourceId,
			])
		: `row:${index}`
}
export function isManuallyMatchableWishlistSource(
	original: WishlistOriginalObservation | undefined,
	required?: "id_conflict",
): original is WishlistOriginalObservation {
	return (
		!!original &&
		original.kind === "want" &&
		(original.mediaType === "unknown" || required === "id_conflict") &&
		!["invalid", "unsupported"].includes(original.problem?.outcome ?? "")
	)
}
