import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getPaletteStart } from "~/server/command-palette/start.server"
import { presentCatalogLoader } from "~/server/media-payload.server"

// Page roles own session/taste reads. Keep this distinct from the search router's exact paths.
export const loader = presentCatalogLoader(
	async ({ request }: LoaderFunctionArgs) =>
		json(await getPaletteStart(request), {
			headers: { "Cache-Control": "private, no-store" },
		}),
	{ live: true },
)
