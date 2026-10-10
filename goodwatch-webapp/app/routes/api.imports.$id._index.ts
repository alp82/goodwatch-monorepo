import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { getImport } from "~/server/imports/service.server"
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) =>
		json({ import: await getImport(userId, importId(params)) }, { headers }),
	)
