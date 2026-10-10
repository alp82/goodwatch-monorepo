// Where a page's files are: on the site's own host (an empty base, so the paths stay as the build wrote them) or on
// the static hostname (`https://static.example.com`). The server chooses per response (see
// server/asset-address.server.ts). A browser follows the page it got: its base is the host that its scripts came from.
//
// Every address of a file that may move goes through `assetUrl`: an image or a font that a module imports, and a file
// from `public/`. An address without it stays on the site's host, which always works.

type Manifest = {
	url: string
	entry: { module: string; imports: string[] }
	routes: Record<
		string,
		{ module: string; imports?: string[]; css?: string[] } | undefined
	>
}

let serverBase: (() => string) | undefined

/** The server names the base of the response that is being rendered. A browser never calls this. */
export function setServerAssetBase(base: () => string): void {
	serverBase = base
}

function browserBase(): string {
	if (typeof document === "undefined") return ""
	const origin = new URL(import.meta.url).origin
	return origin === window.location.origin ? "" : origin
}
const fromScripts = browserBase()

/** The base of the current response on the server, and of the loaded page in a browser. Empty on the site's host. */
export function assetBase(): string {
	return serverBase ? serverBase() : fromScripts
}

const at = (base: string, path: string) =>
	base && path.startsWith("/") ? base + path : path

/** The address of a build file or a `public/` file, given as a path from the root: `/assets/logo-AbCd1234.svg`. */
export function assetUrl(path: string): string {
	return at(assetBase(), path)
}

/** A copy of Remix's file list (entry, routes, their imports and style sheets) with every address on `base`. */
export function manifestAt<T extends Manifest>(manifest: T, base: string): T {
	if (!base) return manifest
	const all = (paths?: string[]) => paths?.map((path) => at(base, path))
	const routes: Manifest["routes"] = {}
	for (const [id, route] of Object.entries(manifest.routes))
		routes[id] = route && {
			...route,
			module: at(base, route.module),
			imports: all(route.imports),
			css: all(route.css),
		}
	return {
		...manifest,
		url: at(base, manifest.url),
		entry: {
			...manifest.entry,
			module: at(base, manifest.entry.module),
			imports: manifest.entry.imports.map((path) => at(base, path)),
		},
		routes,
	}
}
