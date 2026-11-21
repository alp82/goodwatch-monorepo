import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { finalAddress } from "~/domain/browse/redirects"
import { formerTvShowsPath } from "~/ui/explore/address"

// `/tv-shows` was the address of `/shows`. The move is permanent and keeps the rest of the path and the query, then
// follows the Browse moves (an old mood, Best to Top) so it lands on the final address in one step.
export const formerTvShowsLoader = ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const [path, search = ""] = formerTvShowsPath(url.pathname, url.search).split("?")
	return redirect(finalAddress(path || "/shows", search), 301)
}
