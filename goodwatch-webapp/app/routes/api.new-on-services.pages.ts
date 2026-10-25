// Every "New on your services" page with titles, with its count and latest arrival day (#489 Part C). The sitemap
// generator reads it (scripts/sitemap_new.py), so the sitemap lists exactly the pages that have titles, by the same
// rule and the same data as the pages and the links between them.
import { json } from "@remix-run/node"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import { newDeps } from "~/server/new-on-services.server"
import { loadPagesIndex } from "~/server/new-on-services-page.server"

export const loader = async () =>
	json(await loadPagesIndex(newDeps), {
		headers: { "Cache-Control": PUBLIC_DATA_CACHE_CONTROL },
	})
