// GET /api/imdb-import/:id/skipped: a CSV download of the rows the import left out (unmatched, unsupported, invalid).
import type { LoaderFunctionArgs } from "@remix-run/node"
import { importId, withMember } from "~/server/imdb-import/http.server"
import { skippedCsv } from "~/server/imdb-import/store.server"

export function loader({ request, params }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const csv = await skippedCsv(userId, importId(params))
		headers.set("Content-Type", "text/csv; charset=utf-8")
		headers.set("Content-Disposition", 'attachment; filename="imdb-import-skipped.csv"')
		// The BOM makes spreadsheet apps read the titles as UTF-8.
		return new Response(`﻿${csv}`, { headers })
	})
}
