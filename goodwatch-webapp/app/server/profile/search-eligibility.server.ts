import {
	type ProfileVisibility,
	canSee,
	owesProfilesStrip,
} from "~/domain/profile"

/** A profile with at least this many public scores may be indexed (owner decision Q5). */
export const INDEX_MIN_SCORES = 20
/** Shared by /u/:handle's shell.indexable and the public member search index. */
export function publicProfileSearchable(
	visibility: ProfileVisibility,
	scores: number,
	claimedAt: string | null,
	noticeSeen: boolean,
): boolean {
	return (
		canSee(visibility, "scores", "guest") &&
		scores >= INDEX_MIN_SCORES &&
		!owesProfilesStrip(claimedAt, noticeSeen)
	)
}
