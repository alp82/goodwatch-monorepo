import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { handleMcpAccountRoute } from "../server/auth/mcp-flow.server.ts"

export const loader = ({ request }: LoaderFunctionArgs) =>
	handleMcpAccountRoute(request, "consent")
export const action = ({ request }: ActionFunctionArgs) =>
	handleMcpAccountRoute(request, "consent")
