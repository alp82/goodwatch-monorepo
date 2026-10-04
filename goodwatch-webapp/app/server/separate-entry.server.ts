// The query encoder worker and the share card renderer each run from their own file. vite.config.js copies those
// files next to build/server/index.js. The code that starts them can end up in build/server/assets/ when the
// server bundle is split into chunks, so the file is one directory up from there.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function separateEntryUrl(file: string, base: string | URL): URL {
	for (const relative of [`./${file}`, `../${file}`]) {
		const url = new URL(relative, base)
		if (existsSync(fileURLToPath(url))) return url
	}
	return new URL(`./${file}`, base)
}
