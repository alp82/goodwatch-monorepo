// POST /api/imdb-import/:id/undo: takes back what a finished import wrote, except ratings the member changed since.
import { type ActionFunctionArgs, json } from "@remix-run/node"
import type { ImdbImportResponse } from "~/domain/imdb-import"
import { undoImport } from "~/server/imdb-import/apply.server"
import { importId, withMember } from "~/server/imdb-import/http.server"

export function action({ request, params }: ActionFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers })
		return json<ImdbImportResponse>({ import: await undoImport(userId, importId(params)) }, { headers })
	})
}
