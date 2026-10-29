import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { parsePeopleParams } from "~/utils/title-people"

export async function loader({ request }: LoaderFunctionArgs) {
	const params = parsePeopleParams(new URL(request.url).searchParams)
	const { getTitlePeoplePage } = await import("~/server/title-people.server")
	return json(await getTitlePeoplePage(params), {
		headers: {
			"Cache-Control":
				"public, max-age=300, s-maxage=3600, stale-while-revalidate=3600",
		},
	})
}
