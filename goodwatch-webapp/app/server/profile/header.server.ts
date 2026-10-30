// The profile header's data (routes/u.$handle.tsx, and Settings for a member with a handle): the shell as the viewer
// sees it, the viewer type and the taste print when they may see the taste, and the posters of the member's best
// scored titles when they may see the scores. The owner's shell stays the owner's while they view their profile as a
// visitor: the header draws that view itself.
import type { ProfileShell } from "~/domain/profile"
import { seesPart } from "~/domain/profile"
import type { WhorlAttribute } from "~/ui/profile/taste/Whorl"
import { getProfileLibrary } from "./library.server"
import { loadProfileShell } from "./page.server"
import { getProfilePortrait } from "./portrait.server"

/** How many posters the header's cover band can show. */
const COVER_POSTERS = 20

export interface ProfileHeaderData {
	shell: ProfileShell
	/** The viewer type, when the viewer may see the taste and it is ready. */
	identity: string | null
	/** The taste print's attributes, under the same rule as `identity`. */
	print: WhorlAttribute[] | null
	/** TMDB poster paths of the best scored titles (highest score, then latest), when the viewer may see the scores. */
	posters: string[]
}

export async function loadProfileHeader(
	request: Request,
	handle: string,
): Promise<
	| { header: ProfileHeaderData; ownerId: string; viewerId: string | null }
	| Response
> {
	const loaded = await loadProfileShell(request, handle, { asVisitor: false })
	if (loaded instanceof Response) return loaded
	const { shell, ownerId, viewerId } = loaded
	// The viewer type, the print and the posters are extras: the header shows without them when they fail.
	const [fingerprint, posters] = await Promise.all([
		seesPart(shell, "taste")
			? getProfilePortrait(ownerId, "fingerprint", {
					scores: seesPart(shell, "scores"),
					summary: true,
					request,
				}).catch((error) => {
					console.error("[profile] header: viewer type failed", error)
					return null
				})
			: null,
		seesPart(shell, "scores")
			? bestPosters(ownerId).catch((error) => {
					console.error("[profile] header: posters failed", error)
					return []
				})
			: [],
	])
	const ready = fingerprint?.status === "ready" ? fingerprint : null
	return {
		header: {
			shell,
			identity: ready?.identity?.name ?? null,
			print:
				ready?.attributes.map((a) => ({
					key: a.key,
					label: a.label,
					family: a.family,
					edge: a.edge,
				})) ?? null,
			posters,
		},
		ownerId,
		viewerId,
	}
}

async function bestPosters(ownerId: string): Promise<string[]> {
	const library = await getProfileLibrary(ownerId)
	return [...library.scored.values()]
		.filter((t) => t.poster)
		.sort(
			(a, b) =>
				(b.score ?? 0) - (a.score ?? 0) ||
				(b.date ?? "").localeCompare(a.date ?? ""),
		)
		.slice(0, COVER_POSTERS)
		.map((t) => t.poster as string)
}
