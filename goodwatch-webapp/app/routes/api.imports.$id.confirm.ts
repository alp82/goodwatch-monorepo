import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { IMPORT_KINDS } from "~/domain/imports"
import { importId, withMember } from "~/server/imports/http.server"
import { confirmImport } from "~/server/imports/service.server"
import { NativeImportError } from "~/server/imports/store.server"
const schema = z
	.object({
		kinds: z.array(z.enum(IMPORT_KINDS)).min(1).max(IMPORT_KINDS.length),
		conflictChoice: z.enum(["keep", "source"]),
		watchDates: z.enum(["preserve", "unknown"]),
	})
	.strict()
export const action = ({ request, params }: ActionFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "POST")
			return json({ error: "Method not allowed" }, { status: 405, headers })
		const parsed = schema.safeParse(await request.json().catch(() => null))
		if (!parsed.success)
			throw new NativeImportError(
				400,
				"Choose what to import and how conflicts and watch dates should be handled.",
			)
		return json(
			{ import: await confirmImport(userId, importId(params), parsed.data) },
			{ headers },
		)
	})
