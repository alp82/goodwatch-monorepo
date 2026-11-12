import { existsSync, readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
export function records(path) {
	const url = path instanceof URL ? path : pathToFileURL(resolve(path))
	const text = existsSync(url)
		? readFileSync(url, "utf8")
		: gunzipSync(readFileSync(new URL(url.href + ".gz"))).toString("utf8")
	return text.trim().split("\n").filter(Boolean).map(JSON.parse)
}
