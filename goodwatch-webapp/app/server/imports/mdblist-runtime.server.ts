import { nativeFetch } from "../native-fetch.server.ts"
import { siteOrigin } from "../site-origin.server.ts"
import { connectMember } from "./connect-runtime.server.ts"
import { createMdblistClient } from "./mdblist-client.server.ts"
import { createMdblistImport } from "./mdblist-import.server.ts"

export const mdblistImport = createMdblistImport({
	// MDBLIST_API_BASE points local previews at a fake MDBList; production leaves it unset.
	client: createMdblistClient({
		fetch: nativeFetch,
		base: process.env.MDBLIST_API_BASE,
	}),
	origin: siteOrigin,
	member: connectMember,
})
