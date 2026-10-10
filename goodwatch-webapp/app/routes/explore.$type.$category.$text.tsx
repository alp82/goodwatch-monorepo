import { redirect, type LoaderFunctionArgs } from "@remix-run/node"
import { formerExplorePath, notFound } from "~/ui/explore/address"

// The explore pages listed titles by a tag. A tag that has a category page now moves there for good. The others have
// no page that replaces them, and a redirect to a hub would read as a soft 404.
export const loader = ({ params, request }: LoaderFunctionArgs) => {
	const path = formerExplorePath(
		params.type || "",
		params.category || "",
		params.text || "",
	)
	if (!path) throw notFound()
	return redirect(`${path}${new URL(request.url).search}`, 301)
}
