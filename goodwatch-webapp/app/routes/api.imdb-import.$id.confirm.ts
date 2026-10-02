// POST /api/imdb-import/:id/confirm: starts writing the previewed ratings, or resumes an import that failed or
// stalled. Answers at once with status `running`; GET /api/imdb-import/:id reports the progress.
import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import type { ImdbImportResponse } from "~/domain/imdb-import"
import { confirmImport } from "~/server/imdb-import/apply.server"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import { importId, readJson, withMember } from "~/server/imdb-import/http.server"

const requestSchema = z.object({ conflictChoice: z.enum(["keep", "imdb"]) })

export function action({ request, params }: ActionFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers })
		const parsed = requestSchema.safeParse(await readJson(request))
		if (!parsed.success)
			throw new ImdbImportError(400, "Choose whether to keep your GoodWatch ratings or use the IMDb ratings, then try again.")
		const summary = await confirmImport(userId, importId(params), parsed.data.conflictChoice)
		return json<ImdbImportResponse>({ import: summary }, { headers })
	})
}
