import type { ActionFunctionArgs } from "@remix-run/node"
import { submit } from "~/server/feedback/runtime.server"
export const action = ({ request }: ActionFunctionArgs) => submit(request)
export const loader = () =>
	new Response(null, {
		status: 405,
		headers: { Allow: "POST", "Cache-Control": "no-store" },
	})
