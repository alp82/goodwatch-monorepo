// Downloads the search query model files into a directory and checks their SHA-256 hashes. The Dockerfile's `models`
// stage runs it so that the image holds the files. The file list, revisions, and hashes are in
// app/server/search-ranking/query-models.server.ts: the app checks the same ones when it starts the encoder.
//
// Usage (Node 24 runs the TypeScript module directly):
//   node scripts/fetch-search-models.mjs <directory>
//
// Exits with code 1 when a download fails or a hash doesn't match, so that a build fails instead of producing an
// image that downloads the files when it starts.
import { ensureQueryModelFiles } from "../app/server/search-ranking/query-models.server.ts"

const dir = process.argv[2]
if (!dir) {
	console.error("Usage: node scripts/fetch-search-models.mjs <directory>")
	process.exit(1)
}

const started = performance.now()
try {
	await ensureQueryModelFiles(dir)
	console.info(
		`Search models: done in ${Math.round((performance.now() - started) / 1000)} s`,
	)
} catch (error) {
	console.error(
		`Search models: fetching the model files into ${dir} failed. The build stops here.`,
	)
	console.error(error)
	process.exit(1)
}
