import { redirect, type LoaderFunctionArgs } from "@remix-run/node"
import { finalAddress } from "~/domain/browse/redirects"
import { formerExplorePath, notFound } from "~/ui/explore/address"

// The explore pages listed titles by a tag. A tag that has a category page now moves there for good. The others have
// no page that replaces them, and a redirect to a hub would read as a soft 404. The target follows the Browse moves
// (an old mood to its new one), so it's the final address.
export const loader = ({ params, request }: LoaderFunctionArgs) => {
	const path = formerExplorePath(params.type || "", params.category || "", params.text || "")
	if (!path) throw notFound()
	return redirect(finalAddress(path, new URL(request.url).search), 301)
}
