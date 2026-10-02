// GET /api/imdb-import/:id: one import, including a preview that hasn't been confirmed. Polled while it runs.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import type { ImdbImportResponse } from "~/domain/imdb-import"
import { importId, withMember } from "~/server/imdb-import/http.server"
import { getImportRow, summarize } from "~/server/imdb-import/store.server"

export function loader({ request, params }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const row = await getImportRow(userId, importId(params))
		return json<ImdbImportResponse>({ import: summarize(row) }, { headers })
	})
}
