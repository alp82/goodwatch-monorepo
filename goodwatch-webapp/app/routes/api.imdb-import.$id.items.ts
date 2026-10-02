// GET /api/imdb-import/:id/items?outcome=…&offset=0&limit=50: the import's rows in file order, a page at a time.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { z } from "zod"
import { IMDB_IMPORT_OUTCOMES, type ImdbImportItemsResponse } from "~/domain/imdb-import"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import { importId, withMember } from "~/server/imdb-import/http.server"
import { listItems } from "~/server/imdb-import/store.server"

const querySchema = z.object({
	outcome: z.enum(IMDB_IMPORT_OUTCOMES).optional(),
	offset: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(200).default(50),
})

export function loader({ request, params }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const search = new URL(request.url).searchParams
		const parsed = querySchema.safeParse({
			outcome: search.get("outcome") || undefined,
			offset: search.get("offset") ?? undefined,
			limit: search.get("limit") ?? undefined,
		})
		if (!parsed.success) throw new ImdbImportError(400, "We couldn't load those titles. Please try again.")
		const { outcome, offset, limit } = parsed.data
		return json<ImdbImportItemsResponse>(await listItems(userId, importId(params), outcome, offset, limit), { headers })
	})
}
