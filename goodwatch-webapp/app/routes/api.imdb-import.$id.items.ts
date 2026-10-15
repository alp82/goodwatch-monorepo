// GET /api/imdb-import/:id/items?outcome=…&offset=0&limit=50: the import's rows in file order, a page at a time.
// ?by=title: what the import changed, or what its Undo changed back, grouped by title (ImportResult).
// ?by=title&section=…&offset=…&limit=…: more titles of one section (ImportResultPage).
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { IMPORT_RESULT_SECTION_KEYS } from "~/domain/import-result"
import { IMDB_IMPORT_OUTCOMES, type ImdbImportItemsResponse } from "~/domain/imdb-import"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import { importId, withMember } from "~/server/imdb-import/http.server"
import { imdbImportResult, imdbImportResultPage } from "~/server/imdb-import/result.server"
import { listItems } from "~/server/imdb-import/store.server"

const querySchema = z.object({
	outcome: z.enum(IMDB_IMPORT_OUTCOMES).optional(),
	offset: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	by: z.enum(["title"]).optional(),
	section: z.enum(IMPORT_RESULT_SECTION_KEYS).optional(),
})

export function loader({ request, params }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const search = new URL(request.url).searchParams
		const parsed = querySchema.safeParse({
			outcome: search.get("outcome") || undefined,
			offset: search.get("offset") ?? undefined,
			limit: search.get("limit") ?? undefined,
			by: search.get("by") || undefined,
			section: search.get("section") || undefined,
		})
		if (!parsed.success) throw new ImdbImportError(400, "We couldn't load those titles. Please try again.")
		const { outcome, offset, limit, by, section } = parsed.data
		const id = importId(params)
		if (by === "title")
			return json(
				section ? await imdbImportResultPage(userId, id, section, offset, limit) : await imdbImportResult(userId, id),
				{ headers },
			)
		return json<ImdbImportItemsResponse>(await listItems(userId, id, outcome, offset, limit), { headers })
	})
}
