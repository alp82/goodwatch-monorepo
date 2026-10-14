import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { createReadMcpHandler } from "~/server/mcp/endpoint.server"

const handle = createReadMcpHandler()
export const loader = ({ request }: LoaderFunctionArgs) => handle(request)
export const action = ({ request }: ActionFunctionArgs) => handle(request)
