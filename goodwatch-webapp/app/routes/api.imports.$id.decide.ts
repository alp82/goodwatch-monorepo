import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { importId, withMember } from "~/server/imports/http.server"
import { decideImport } from "~/server/imports/service.server"
import { NativeImportError } from "~/server/imports/store.server"
import { analyticsAction } from "~/telemetry/product-analytics.server"
const schema = z
	.object({
		question: z.literal("conflict"),
		answer: z.enum(["keep", "source"]),
		rows: z.array(z.number().int().safe().min(0)).max(500).optional(),
	})
	.strict()
export const action = analyticsAction(
	({ request, params }: ActionFunctionArgs) =>
		withMember(request, async (userId, headers) => {
			if (request.method !== "POST")
				return json({ error: "Method not allowed" }, { status: 405, headers })
			const parsed = schema.safeParse(await request.json().catch(() => null))
			if (!parsed.success)
				throw new NativeImportError(
					400,
					"Choose a valid answer and import rows.",
				)
			const { question, answer, rows } = parsed.data
			return json(
				await decideImport(userId, importId(params), question, answer, rows),
				{ headers },
			)
		}),
)
