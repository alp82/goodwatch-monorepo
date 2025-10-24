import type { LoaderFunctionArgs } from "@remix-run/node"
import { redirect } from "@remix-run/node"

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const showKey = params.showKey || ""
	
	if (!showKey) {
		return redirect("/", { status: 301 })
	}
	
	const newPath = `/show/${showKey}`
	const search = url.search

	return redirect(`${newPath}${search}`, { status: 301 })
}
