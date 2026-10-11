import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { formerTvShowsPath } from "~/ui/explore/address"

// `/tv-shows` was the address of `/shows`. The move is permanent and keeps the rest of the path and the query.
export const formerTvShowsLoader = ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	return redirect(formerTvShowsPath(url.pathname, url.search), 301)
}
