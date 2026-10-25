import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { loadProfileShell } from "~/server/profile/page.server"
import { excerptParams } from "~/server/profile/tropes-model"
import { loadProfileTropeExcerpts } from "~/server/profile/tropes.server"

const headers = { "Cache-Control": "private, max-age=60", Vary: "Cookie" }

export async function loader({ request, params }: LoaderFunctionArgs) {
	const input = excerptParams(new URL(request.url).searchParams)
	if (!input) return json({ examples: [] }, { status: 400, headers })
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const examples = await loadProfileTropeExcerpts(
		loaded.ownerId,
		loaded.shell,
		input.trope,
		input.keys,
	)
	return json({ examples }, { headers })
}
