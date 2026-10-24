import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { decideImport } from "~/server/imdb-import/apply.server"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import {
	importId,
	readJson,
	withMember,
} from "~/server/imdb-import/http.server"
import { analyticsAction } from "~/telemetry/product-analytics.server"

const schema = z
	.object({
		answer: z.enum(["keep", "imdb"]),
		rows: z.array(z.number().int().safe().min(0)).min(1).max(500).optional(),
	})
	.strict()

export const action = analyticsAction(
	({ request, params }: ActionFunctionArgs) =>
		withMember(request, async (userId, headers) => {
			if (request.method !== "POST")
				return json({ error: "Method not allowed" }, { status: 405, headers })
			const parsed = schema.safeParse(await readJson(request))
			if (!parsed.success)
				throw new ImdbImportError(400, "Choose a valid answer and import rows.")
			return json(
				await decideImport(
					userId,
					importId(params),
					parsed.data.answer,
					parsed.data.rows,
				),
				{ headers },
			)
		}),
)
