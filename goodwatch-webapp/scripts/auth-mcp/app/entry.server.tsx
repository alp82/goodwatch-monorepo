import "../setup.server.ts"
import type { EntryContext } from "@remix-run/node"
import { RemixServer } from "@remix-run/react"
import { renderToString } from "react-dom/server"

// Only the sign-in and consent pages render documents here; everything else is a resource route.
export default function handleRequest(request: Request, status: number, headers: Headers, context: EntryContext) {
	const html = renderToString(<RemixServer context={context} url={request.url} />)
	headers.set("Content-Type", "text/html; charset=utf-8")
	return new Response(`<!DOCTYPE html>${html}`, { status, headers })
}
