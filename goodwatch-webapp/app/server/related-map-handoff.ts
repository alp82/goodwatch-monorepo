// A title page's loader sends the related map's markup in its data, for every request (related-map.server.ts). A
// navigation inside the app needs it there. A document doesn't: the server renders the markup into the section, and
// the browser reads it from there (ui/related-map/RelatedMap.tsx). So a document render takes it out of the page
// data that Remix writes into the document, `window.__remixContext`.
//
// Only the render knows for sure that it renders a document: the loader sees the same address for both, and request
// headers only hint at which one it is. A loader that guessed from them made a stored page depend on whichever client
// asked first (see "A page depends on its key only" in docs/page-cache.md).

/** The part of Remix's entry context that this reads and replaces. */
export interface HandoffContext {
	serverHandoffString?: string
	staticHandlerContext: { loaderData: Record<string, unknown> }
}

const ESCAPES: Record<string, string> = {
	"&": "\\u0026",
	">": "\\u003e",
	"<": "\\u003c",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
}

/** How Remix writes the page data into an inline script (`createServerHandoffString` in @remix-run/server-runtime). */
const escapeForScript = (json: string) =>
	json.replace(/[&><\u2028\u2029]/g, (ch) => ESCAPES[ch])

const markupOf = (data: unknown): unknown =>
	(data as { relatedMap?: { html?: unknown } } | null | undefined)?.relatedMap
		?.html

/**
 * The entry context of a document render, with the related map's markup taken out of the page data. The render
 * itself still reads the loader's data with the markup. Returns the context unchanged when no route has the markup.
 */
export function withoutRelatedMapMarkup<T extends HandoffContext>(context: T): T {
	const routes = Object.keys(context.staticHandlerContext.loaderData).filter(
		(id) => typeof markupOf(context.staticHandlerContext.loaderData[id]) === "string",
	)
	if (!routes.length || !context.serverHandoffString) return context
	const handoff = JSON.parse(context.serverHandoffString) as {
		state?: { loaderData?: Record<string, { relatedMap?: { html?: string } }> }
	}
	// Without the state in it (Remix's single fetch streams the state apart), there's nothing to take out here.
	if (!handoff.state?.loaderData) return context
	for (const id of routes) delete handoff.state.loaderData[id]?.relatedMap?.html
	return { ...context, serverHandoffString: escapeForScript(JSON.stringify(handoff)) }
}
