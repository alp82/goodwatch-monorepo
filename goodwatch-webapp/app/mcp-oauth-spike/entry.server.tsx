import { renderToString } from "react-dom/server"
import { RemixServer } from "@remix-run/react"
import type { EntryContext } from "@remix-run/node"

export default function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	context: EntryContext,
) {
	headers.set("Content-Type", "text/html; charset=utf-8")
	headers.set("Cache-Control", "no-store")
	return new Response(
		`<!doctype html>${renderToString(<RemixServer context={context} url={request.url} />)}`,
		{ status, headers },
	)
}
