import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { IMPORT_RESULT_SECTION_KEYS } from "~/domain/import-result"
import { IMPORT_MAX_ROWS } from "~/domain/imports"
import { importId, withMember } from "~/server/imports/http.server"
import {
	getImportItems,
	getImportResult,
	getImportResultPage,
} from "~/server/imports/service.server"
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
	by: z.enum(["title"]).optional(),
	section: z.enum(IMPORT_RESULT_SECTION_KEYS).optional(),
})
// ?by=title: what the import changed, or what its Undo changed back, grouped by title (ImportResult).
// ?by=title&section=…&offset=…&limit=…: more titles of one section (ImportResultPage).
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		const q = new URL(request.url).searchParams
		const parsed = schema.safeParse({
			outcome: q.get("outcome") || undefined,
			offset: q.get("offset") ?? undefined,
			limit: q.get("limit") ?? undefined,
			by: q.get("by") || undefined,
			section: q.get("section") || undefined,
		})
		if (!parsed.success)
			throw new NativeImportError(400, "We couldn't load those import rows.")
		const id = importId(params)
		const { by, section, outcome, offset, limit } = parsed.data
		if (by === "title")
			return json(
				section
					? await getImportResultPage(userId, id, section, offset, limit)
					: await getImportResult(userId, id),
				{ headers },
			)
		return json(await getImportItems(userId, id, outcome, offset, limit), {
			headers,
		})
	})
