// GET /api/imdb-import/:id/posters?limit=24&outcome=…: posters of the titles an IMDb import brings, for the import
// screens' poster rows. Reads at most a few hundred of the import's rows, never the whole import.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import { importId, withMember } from "~/server/imdb-import/http.server"
import { imdbImportPosters } from "~/server/imdb-import/result.server"

const schema = z.object({
	outcome: z.enum(["new", "update", "conflict", "unchanged"]).optional(),
	limit: z.coerce.number().int().min(1).max(48).default(24),
})

export function loader({ request, params }: LoaderFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		const q = new URL(request.url).searchParams
		const parsed = schema.safeParse({
			outcome: q.get("outcome") || undefined,
			limit: q.get("limit") ?? undefined,
		})
		if (!parsed.success)
			throw new ImdbImportError(400, "We couldn't load those posters.")
		const { outcome, limit } = parsed.data
		return json(
			await imdbImportPosters(userId, importId(params), outcome, limit),
			{ headers },
		)
	})
}
