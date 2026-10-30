// The profile header's data (routes/u.$handle.tsx, Settings and list pages for a member with a handle): the shell as
// the viewer sees it, the viewer type and the taste print when they may see the taste, and for a signed-in visitor on
// someone else's profile, the match with them. The owner's shell stays the owner's while they view
// their profile as a visitor: the header cuts that view itself (ui/profile/header/facts.ts builds its facts from the
// shell). The match is kept in process memory for KEEP_MS.
import type { ProfileShell } from "~/domain/profile"
import { seesPart } from "~/domain/profile"
import { type MatchTier, matchTier } from "~/domain/profile-taste"
import { getMemberMatch } from "~/server/taste/member-match.server"
import type { WhorlAttribute } from "~/ui/profile/taste/Whorl"
import { loadProfileShell } from "./page.server"
import { getProfilePortrait } from "./portrait.server"

const KEEP_MS = 2 * 60_000
const MAX_KEPT = 200

/** The signed-in visitor's match with the profile's owner, for the header. */
export interface HeaderMatch {
	percent: number
	tier: MatchTier
}

export interface ProfileHeaderData {
	shell: ProfileShell
	/** The viewer type, when the viewer may see the taste and it is ready. */
	identity: string | null
	/** The taste print's attributes, under the same rule as `identity`. */
	print: WhorlAttribute[] | null
	/** For a member on someone else's profile, when both have enough scores. */
	match: HeaderMatch | null
}

const printOf = (
	view: Awaited<ReturnType<typeof getProfilePortrait<"fingerprint">>> | null,
): WhorlAttribute[] | null =>
	view?.status === "ready"
		? view.attributes.map((a) => ({
				key: a.key,
				label: a.label,
				family: a.family,
				edge: a.edge,
			}))
		: null

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
	// The viewer type, the print and the match are extras: the header shows without them when they fail.
	const [fingerprint, match] = await Promise.all([
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
		shell.viewer === "member" && viewerId
			? keep(`match:${viewerId}:${ownerId}`, () =>
					readMatch(viewerId, ownerId),
				).catch((error) => {
					console.error("[profile] header: match failed", error)
					return null
				})
			: null,
	])
	const ready = fingerprint?.status === "ready" ? fingerprint : null
	return {
		header: {
			shell,
			identity: ready?.identity?.name ?? null,
			print: printOf(ready),
			match,
		},
		ownerId,
		viewerId,
	}
}

const kept = new Map<
	string,
	{ at: number; value: Promise<HeaderMatch | null> }
>()

/** One value per key for KEEP_MS; a failed read is dropped so the next view tries again. */
function keep(
	key: string,
	read: () => Promise<HeaderMatch | null>,
): Promise<HeaderMatch | null> {
	const hit = kept.get(key)
	if (hit && Date.now() - hit.at < KEEP_MS) return hit.value
	const value = read()
	kept.delete(key)
	kept.set(key, { at: Date.now(), value })
	value.catch(() => kept.delete(key))
	for (const old of kept.keys()) {
		if (kept.size <= MAX_KEPT) break
		kept.delete(old)
	}
	return value
}

async function readMatch(
	viewerId: string,
	ownerId: string,
): Promise<HeaderMatch | null> {
	const match = await getMemberMatch(viewerId, ownerId)
	if ("thin" in match) return null
	return { percent: match.percent, tier: matchTier(match.percent) }
}
