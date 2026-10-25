// What every /u/:handle route's loader does: the shell (or the redirect to the lowercase handle, or 404), the page's
// own data, the visitor's scores for "You" tags when the page shows them, and the profile's cache headers.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import type { ProfileShell, ProfileTitle } from "~/domain/profile"
import { type RowServices, rowServices } from "~/server/row-services.server"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, isSeen } from "~/types/user-data"
import { loadProfileShell, profileCacheControl } from "./page.server"
import { yourScores } from "./your-scores.server"

export async function profileLoader<T extends object>(
	{ params, request }: LoaderFunctionArgs,
	load: (ctx: {
		ownerId: string
		viewerId: string | null
		shell: ProfileShell
	}) => Promise<T>,
) {
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const data = await load(loaded)
	return json(
		{ shell: loaded.shell, ...data },
		{ headers: { "Cache-Control": profileCacheControl(loaded.viewerId) } },
	)
}

/** The signed-in visitor's scores for the titles on a page; null for the owner, a guest, or a visitor who can't
 * compare yet. */
export async function visitorScores(
	viewerId: string | null,
	shell: ProfileShell,
	keys: Iterable<string>,
) {
	if (!viewerId || shell.viewer !== "member") return null
	return yourScores(viewerId, keys)
}

/**
 * A signed-in visitor's own services on the titles of a page that they haven't seen, for the logos in its rows; null
 * for the owner, a guest, or a visitor without saved services.
 */
export async function visitorServices(
	request: Request,
	viewerId: string | null,
	shell: ProfileShell,
	titles: readonly ProfileTitle[],
): Promise<RowServices | null> {
	if (!viewerId || shell.viewer !== "member") return null
	const data = await getUserData({ user_id: viewerId })
	return rowServices(
		request,
		titles.filter((t) => !isSeen(data, t.key as MediaKey)),
		viewerId,
	)
}
