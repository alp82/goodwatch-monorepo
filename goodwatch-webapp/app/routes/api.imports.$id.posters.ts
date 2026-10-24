// GET /api/imports/:id/posters?limit=24&outcome=…: posters of the titles an import brings, for the import screens'
// poster rows. Reads at most a few hundred of the import's rows, never the whole import.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { importId, withMember } from "~/server/imports/http.server"
import { getImportPosters } from "~/server/imports/service.server"
import { NativeImportError } from "~/server/imports/store.server"

const schema = z.object({
	outcome: z.enum(["new", "conflict", "unchanged"]).optional(),
	limit: z.coerce.number().int().min(1).max(48).default(24),
})

export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		const q = new URL(request.url).searchParams
		const parsed = schema.safeParse({
			outcome: q.get("outcome") || undefined,
			limit: q.get("limit") ?? undefined,
		})
		if (!parsed.success)
			throw new NativeImportError(400, "We couldn't load those posters.")
		const { outcome, limit } = parsed.data
		return json(
			await getImportPosters(userId, importId(params), outcome, limit),
			{ headers },
		)
	})
