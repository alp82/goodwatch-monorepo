import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getAuthFromRequest } from "~/utils/auth"
import type { ImdbImportListResponse } from "../../domain/imdb-import.ts"
import { IMPORT_ID_PATTERN, type ImportSummary } from "../../domain/imports.ts"
import { listImportRows, summarize } from "../imdb-import/store.server.ts"
import { getImport, listImports } from "./service.server.ts"

// The earlier imports come with the page, so it shows at once. They are an extra: if they can't be read,
// the page still offers the upload.
interface LoaderData extends ImdbImportListResponse {
	sourceImports: ImportSummary[]
	connectState?: string
	openImport?: string
	initialSource?: "tmdb"
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user)
		return json<LoaderData>({ imports: [], sourceImports: [] }, { headers })
	const [imdb, native] = await Promise.all([
		listImportRows(user.id)
			.then((rows) => rows.map(summarize))
			.catch((error) => {
				console.error("IMDb import: reading history failed:", error)
				return []
			}),
		listImports(user.id).catch((error) => {
			console.error("Source import: reading history failed:", error)
			return []
		}),
	])
	const url = new URL(request.url)
	const connectState = url.searchParams.get("connect") ?? ""
	const openImport = url.searchParams.get("import") ?? ""
	const selected = IMPORT_ID_PATTERN.test(openImport)
		? await getImport(user.id, openImport).catch(() => null)
		: null
	return json<LoaderData>(
		{
			imports: imdb,
			sourceImports: native,
			initialSource:
				url.searchParams.get("source") === "tmdb" ? "tmdb" : undefined,
			connectState: IMPORT_ID_PATTERN.test(connectState)
				? connectState
				: undefined,
			openImport: selected?.source === "tmdb" ? openImport : undefined,
		},
		{ headers },
	)
}
