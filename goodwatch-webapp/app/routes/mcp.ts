import { withProductContext } from "~/telemetry/product-analytics.server"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"

// The MCP SDK and the tools load on the first request to /mcp, not at server start.
let handler: Promise<(request: Request) => Promise<Response>> | undefined
function handle(request: Request) {
	handler ??= import("../server/mcp/endpoint.server.ts").then(
		({ createReadMcpHandler }) => createReadMcpHandler(),
		(error) => {
			handler = undefined
			throw error
		},
	)
	return handler.then((answer) =>
		withProductContext({ source: "mcp" }, () => answer(request)),
	)
}
export const loader = ({ request }: LoaderFunctionArgs) => handle(request)
export const action = ({ request }: ActionFunctionArgs) => handle(request)
