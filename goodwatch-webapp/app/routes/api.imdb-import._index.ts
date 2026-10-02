// GET /api/imdb-import: the member's IMDb imports, newest first. Previews that were never confirmed are left out.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import type { ImdbImportListResponse } from "~/domain/imdb-import"
import { withMember } from "~/server/imdb-import/http.server"
import { listImportRows, summarize } from "~/server/imdb-import/store.server"

export function loader({ request }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const rows = await listImportRows(userId)
		return json<ImdbImportListResponse>({ imports: rows.map(summarize) }, { headers })
	})
}
