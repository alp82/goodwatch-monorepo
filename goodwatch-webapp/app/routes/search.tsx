import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { discoverSearchPath } from "~/domain/discover-search";

// Search is Discover's search mode: /search?q=… moves to /discover?q=…, keeping the filters the two pages share.
export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams;
	return redirect(discoverSearchPath(params), {
		status: 301,
		headers: { "Cache-Control": "private, no-store" },
	});
}
