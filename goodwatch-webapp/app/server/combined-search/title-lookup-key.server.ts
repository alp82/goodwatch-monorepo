// The key of the search's in-process title lookup cache (combined-search/search.server.ts). Search text is private:
// the key is a digest and is never written to a shared store or logged.
import { createHash } from "node:crypto"

/**
 * One key per text, adult policy, and alias rules version of the loaded index: a lookup made before the localized
 * names loaded isn't served after.
 */
export function titleLookupKey(
	q: string,
	includeAdult: boolean,
	aliasVersion: number,
): string {
	return createHash("sha256")
		.update(`${aliasVersion}:${includeAdult ? 1 : 0}:${q.trim().toLowerCase()}`)
		.digest("hex")
}
