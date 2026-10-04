import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { parseTitleCastParams } from "~/utils/title-cast"

export async function loader({ request }: LoaderFunctionArgs) {
	const params = parseTitleCastParams(new URL(request.url).searchParams)
	const { getTitleCastPage } = await import("~/server/title-cast.server")
	return json(await getTitleCastPage(params), {
		headers: {
			"Cache-Control":
				"public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
		},
	})
}
