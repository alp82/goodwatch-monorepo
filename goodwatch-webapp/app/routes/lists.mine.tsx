// "My lists": the person's own profile, where they manage their lists. Links in the user menu and on Taste point here
// so they don't need to know the handle. A signed-in person without a handle has no lists yet, and a guest can only
// keep a draft in the browser; both go to the new-list editor, which restores that draft.
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { getProfileByUserId } from "~/server/share-lists/store.server"
import { newListPath, profilePath } from "~/ui/share-card/links"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getProfileByUserId(userId) : null
	return redirect(profile ? profilePath(profile.handle) : newListPath(), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

// The loader always redirects, so this never renders; it keeps the path a page route for <Link>.
export default function MyLists() {
	return null
}
