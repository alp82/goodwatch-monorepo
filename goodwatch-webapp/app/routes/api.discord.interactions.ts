import type { ActionFunctionArgs } from "@remix-run/node"
import { handleInteraction } from "../server/discord/endpoint.server.ts"
export const action = ({ request }: ActionFunctionArgs) =>
	handleInteraction(request)
export const loader = () =>
	new Response(null, { status: 405, headers: { Allow: "POST" } })
