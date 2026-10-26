import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileShell } from "~/server/profile/page.server"
import { seesTropes } from "~/server/profile/tropes-model"
import { loadProfileTropes } from "~/server/profile/tropes.server"
import { profileTropeResource } from "~/utils/profile-trope-resource"

// The full filtering matrix is fetched after the first paint. Viewer Seen state is always private.
export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) => {
		const loaded = await loadProfileShell(request, params.handle ?? "")
		if (loaded instanceof Response) return loaded
		const tropes = await loadProfileTropes(
			loaded.ownerId,
			loaded.shell,
			loaded.viewerId,
			{ wait: false, descriptions: false },
		)
		const pending = seesTropes(loaded.shell) && (!tropes || !!tropes.refreshing)

		return json(
			profileTropeResource(tropes, pending, new URL(request.url).searchParams),
			{
				headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
			},
		)
	},
	{ live: true },
)
