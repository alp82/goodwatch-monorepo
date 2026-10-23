// What every /u/:handle route's loader does: the shell (or the redirect to the lowercase handle, or 404), the page's
// own data, the visitor's scores for "You" tags when the page shows them, and the profile's cache headers.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import type { ProfileShell } from "~/domain/profile"
import { loadProfileShell, profileCacheControl } from "./page.server"
import { yourScores } from "./your-scores.server"

export async function profileLoader<T extends object>(
	{ params, request }: LoaderFunctionArgs,
	load: (ctx: { ownerId: string; viewerId: string | null; shell: ProfileShell }) => Promise<T>,
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
export async function visitorScores(viewerId: string | null, shell: ProfileShell, keys: Iterable<string>) {
	if (!viewerId || shell.viewer !== "member") return null
	return yourScores(viewerId, keys)
}
