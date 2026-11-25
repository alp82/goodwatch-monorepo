import { currentAssetBase } from "../server/asset-address.server.ts"
import { browseGeneration } from "../server/browse-edge.server.ts"

/** Used on demand at the edge to notice deploys and automatic static-host fallback. */
export function loader() {
	const generation = browseGeneration(process.env.SOURCE_COMMIT, currentAssetBase())
	return new Response(generation, {
		status: generation ? 200 : 503,
		headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
	})
}
