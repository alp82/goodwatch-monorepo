// Every "New on your services" page with titles, with its count and latest arrival day (#489 Part C). The sitemap
// generator reads it (scripts/sitemap_new.py), so the sitemap lists exactly the pages that have titles, by the same
// rule and the same data as the pages and the links between them.
import { json } from "@remix-run/node"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import { newDeps } from "~/server/new-on-services.server"
import { loadPagesIndex } from "~/server/new-on-services-page.server"

// An incomplete index (a country's read failed) is an error, never stored: the sitemap keeps its last file rather than
// publishing a list with countries missing.
export const loader = async () => {
	const index = await loadPagesIndex(newDeps)
	if (index.failed.length)
		return json(
			{ error: "incomplete", failed: index.failed },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		)
	return json(
		{ pages: index.pages },
		{ headers: { "Cache-Control": PUBLIC_DATA_CACHE_CONTROL } },
	)
}
