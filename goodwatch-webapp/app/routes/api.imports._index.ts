import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { withMember } from "~/server/imports/http.server"
import { listImports } from "~/server/imports/service.server"
export const loader = ({ request }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) =>
		json({ imports: await listImports(userId) }, { headers }),
	)
