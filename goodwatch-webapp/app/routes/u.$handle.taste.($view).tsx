// The profile's Taste tab became Stats (/u/:handle/stats); old links, sections and their query keep working.
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"

export const loader = ({ params, request }: LoaderFunctionArgs) => {
	const view = params.view ? `/${encodeURIComponent(params.view)}` : ""
	const handle = encodeURIComponent(params.handle ?? "")
	return redirect(
		`/u/${handle}/stats${view}${new URL(request.url).search}`,
		301,
	)
}
