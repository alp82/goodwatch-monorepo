// PROTOTYPE - throwaway. The intro film's data, fetched by the browser during the TV's boot (v-film.tsx), so the start
// page's HTML stays small. Not for production builds.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { tvHomeLoader } from "~/server/living-room/tv-loader.server"
import { loadIntroData } from "~/server/prototype-intro/index.server"

export async function loader(args: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const res = (await tvHomeLoader(args as never)) as Response
	const home = await res.json()
	return json(await loadIntroData(args.request, home), { headers: { "Cache-Control": "private, max-age=300" } })
}
