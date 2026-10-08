// Chooses, per response, where a page's files are: on the site's own host or on the static hostname.
//
// - `currentAssetBase` is the address for a response that starts now: empty for the site's own host, or
//   `https://static.example.com`.
// - The server entry renders inside `renderWithAssetBase`, and `assetUrl` (utils/asset-url.ts) reads the address from
//   there. A render that suspends keeps its address until it ends, whatever later responses get.
// - Remix writes one file list into the build, with paths. `manifestForBase` keeps one more copy of it per address.
import { AsyncLocalStorage } from "node:async_hooks"

import { manifestAt, setServerAssetBase } from "../utils/asset-url.ts"

const rendering = new AsyncLocalStorage<string>()
setServerAssetBase(() => rendering.getStore() ?? "")

export function currentAssetBase(): string {
	return ""
}

export function renderWithAssetBase<T>(base: string, render: () => T): T {
	return rendering.run(base, render)
}

type Manifest = Parameters<typeof manifestAt>[0]
const copies = new WeakMap<Manifest, Map<string, Manifest>>()
export function manifestForBase<T extends Manifest>(
	manifest: T,
	base: string,
): T {
	if (!base) return manifest
	let known = copies.get(manifest)
	if (!known) copies.set(manifest, (known = new Map()))
	let copy = known.get(base) as T | undefined
	if (!copy) known.set(base, (copy = manifestAt(manifest, base)))
	return copy
}
