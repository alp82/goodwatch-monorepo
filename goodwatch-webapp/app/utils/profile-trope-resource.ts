import type { ProfileShell } from "../domain/profile.ts"
import type { ProfileTropes } from "../server/profile/tropes-data.ts"

export interface ProfileTropeResource {
	tropes: ProfileTropes | null
	pending: boolean
	unchanged: boolean
	/** Viewer state is fresh even when the owner's matrix and catalog definitions are unchanged. */
	seen?: string[]
}

export const wantsThinTropes = (params: URLSearchParams) =>
	params.get("format") === "thin-v1"

/** Opt in on every v3 request, including the first request with no cached versions. */
export function profileTropeRequestParams(previous?: ProfileTropeResource) {
	const params = new URLSearchParams({ format: "thin-v1" })
	if (previous?.tropes?.version)
		params.set("version", String(previous.tropes.version))
	if (previous?.tropes?.catalogVersion)
		params.set("catalogVersion", previous.tropes.catalogVersion)
	return params
}

/** Definitions and source associations have their own small, authorized resources. */
export function thinProfileTropes(tropes: ProfileTropes): ProfileTropes {
	const { references, labels, descriptions, ...matrix } = tropes
	return { ...matrix, descriptions: {}, catalogVersion: "thin-v1" }
}

export function profileTropeResource(
	tropes: ProfileTropes | null,
	pending: boolean,
	params: URLSearchParams,
): ProfileTropeResource {
	// Existing open tabs still expect the full contract throughout a rolling deployment.
	const thin =
		tropes && wantsThinTropes(params) ? thinProfileTropes(tropes) : tropes
	const unchanged =
		!!thin?.version &&
		params.get("version") === String(thin.version) &&
		params.get("catalogVersion") === thin.catalogVersion
	return unchanged
		? { tropes: null, pending, unchanged: true, seen: thin.seen }
		: { tropes: thin, pending, unchanged: false }
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
		"profile-tropes-data-v3",
		shell.handle,
		shell.viewer,
		userId,
		shell.visibility,
		language,
	]
}
