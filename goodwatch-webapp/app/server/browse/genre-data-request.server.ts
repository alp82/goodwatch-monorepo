import { AsyncLocalStorage } from "node:async_hooks"
import type { IncomingMessage } from "node:http"
import { legacyDocumentPath } from "../../utils/genre-panel-data.ts"

// Remix strips _data before loaders run. Only the old genre-index wire format needs to upgrade
// to a document after address validation and before collecting its title cards.
const legacyDocument = new AsyncLocalStorage<string>()
export const legacyGenreDocumentForLoader = () => legacyDocument.getStore()

export function withGenreDataRequest<T>(
	request: Pick<IncomingMessage, "method" | "url">,
	run: () => T,
): T {
	const target = request.url
	if (
		request.method !== "GET" ||
		!target?.startsWith("/") ||
		!target.includes("/genres") ||
		!target.includes("?")
	)
		return run()
	const document = legacyDocumentPath(new URL(`http://localhost${target}`))
	return document ? legacyDocument.run(document, run) : run()
}
