// Country flags for the cards, as data URIs. The flags are the site's own (public/flags, 3:2 SVGs of 0.2 to 5 KB from
// country-flag-icons): public/ in development, build/client/ once built. Relative to this module, with the working
// directory as a fallback, as the share card fonts are found (card-renderer/pool.server.ts).
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const FLAG_DIR = "flags"
const PROBE = "US.svg"

let dir: string | null | undefined
function flagDir() {
	if (dir !== undefined) return dir
	const here = fileURLToPath(new URL(".", import.meta.url))
	const candidates = [
		join(here, "../../../public", FLAG_DIR),
		join(here, "../client", FLAG_DIR),
		...["public", "build/client"].map((base) =>
			join(process.cwd(), base, FLAG_DIR),
		),
	]
	dir = candidates.find((candidate) => existsSync(join(candidate, PROBE))) ?? null
	if (!dir) console.warn(`[og-image] flags not found in ${candidates.join(" or ")}`)
	return dir
}

const flags = new Map<string, Promise<string | null>>()

/** A country's flag as a data URI, or null for a code without a flag. `code` is ISO 3166-1 alpha-2, such as "DE". */
export function flagDataUri(code: string): Promise<string | null> {
	const key = code.toUpperCase()
	if (!/^[A-Z]{2}$/.test(key)) return Promise.resolve(null)
	let flag = flags.get(key)
	if (!flag) {
		const base = flagDir()
		flag = base
			? readFile(join(base, `${key}.svg`)).then(
					(svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`,
					() => null,
				)
			: Promise.resolve(null)
		flags.set(key, flag)
	}
	return flag
}
