import { type ActionFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { undoImport } from "~/server/imports/service.server"
export const action = ({ request, params }: ActionFunctionArgs) =>
	withMember(request, async (userId, headers) =>
		request.method === "POST"
			? json(
					{ import: await undoImport(userId, importId(params)) },
					{ headers },
				)
			: json({ error: "Method not allowed" }, { status: 405, headers }),
	)
