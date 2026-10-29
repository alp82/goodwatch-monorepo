// The profile header's data (routes/u.$handle.tsx, and Settings for a member with a handle): the shell as the viewer
// sees it, and the viewer type when they may see the taste. The owner's shell stays the owner's while they view their
// profile as a visitor: the header draws that view itself.
import type { ProfileShell } from "~/domain/profile"
import { seesPart } from "~/domain/profile"
import { loadProfileShell } from "./page.server"
import { getProfilePortrait } from "./portrait.server"

export interface ProfileHeaderData {
	shell: ProfileShell
	/** The viewer type, when the viewer may see the taste and it is ready. */
	identity: string | null
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
	// The viewer type is an extra: the header shows without it when it fails.
	const fingerprint = seesPart(shell, "taste")
		? await getProfilePortrait(ownerId, "fingerprint", {
				scores: seesPart(shell, "scores"),
				summary: true,
				request,
			}).catch((error) => {
				console.error("[profile] header: viewer type failed", error)
				return null
			})
		: null
	const identity =
		fingerprint?.status === "ready" ? (fingerprint.identity?.name ?? null) : null
	return { header: { shell, identity }, ownerId, viewerId }
}
