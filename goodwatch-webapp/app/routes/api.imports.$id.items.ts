import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { IMPORT_MAX_ROWS } from "~/domain/imports"
import { importId, withMember } from "~/server/imports/http.server"
import { getImportItems } from "~/server/imports/service.server"
import { NativeImportError } from "~/server/imports/store.server"
const schema = z.object({
	outcome: z
		.enum([
			"new",
			"unchanged",
			"conflict",
			"unmatched",
			"unsupported",
			"invalid",
		])
		.optional(),
	offset: z.coerce.number().int().safe().min(0).max(IMPORT_MAX_ROWS).default(0),
	limit: z.coerce.number().int().safe().min(1).max(200).default(50),
})
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		const q = new URL(request.url).searchParams
		const parsed = schema.safeParse({
			outcome: q.get("outcome") || undefined,
			offset: q.get("offset") ?? undefined,
			limit: q.get("limit") ?? undefined,
		})
		if (!parsed.success)
			throw new NativeImportError(400, "We couldn't load those import rows.")
		return json(
			await getImportItems(
				userId,
				importId(params),
				parsed.data.outcome,
				parsed.data.offset,
				parsed.data.limit,
			),
			{ headers },
		)
	})
