import type { ProfileShell } from "../domain/profile.ts"
import type { ProfileTropes } from "../server/profile/tropes-data.ts"

export interface ProfileTropeResource {
	tropes: ProfileTropes | null
	pending: boolean
	unchanged: boolean
	/** Viewer state is fresh even when the owner's matrix and catalog definitions are unchanged. */
	seen?: string[]
}

export function profileTropeResource(
	tropes: ProfileTropes | null,
	pending: boolean,
	params: URLSearchParams,
): ProfileTropeResource {
	const unchanged =
		!!tropes?.version &&
		params.get("version") === String(tropes.version) &&
		params.get("catalogVersion") === tropes.catalogVersion
	return unchanged
		? { tropes: null, pending, unchanged: true, seen: tropes.seen }
		: { tropes, pending, unchanged: false }
}

export function mergeProfileTropeResource(
	previous: ProfileTropeResource | undefined,
	result: ProfileTropeResource,
): ProfileTropeResource {
	if (!result.unchanged) return result
	return {
		...result,
		tropes: previous?.tropes
			? { ...previous.tropes, seen: result.seen ?? previous.tropes.seen }
			: null,
	}
}

/** The root's saved display language changes after revalidation; localized title matrices cannot cross it. */
export function profileTropeQueryKey(
	shell: Pick<ProfileShell, "handle" | "viewer" | "visibility">,
	userId: string | null,
	language: string,
) {
	return [
		"profile-tropes-data",
		shell.handle,
		shell.viewer,
		userId,
		shell.visibility,
		language,
	]
}
