// Chooses, per response, where a page's files are: on the site's own host or on the static hostname.
//
// - `currentAssetBase` is the address for a response that starts now: empty for the site's own host, or
//   `https://static.example.com`.
// - The server entry renders inside `renderWithAssetBase`, and `assetUrl` (utils/asset-url.ts) reads the address from
//   there. A render that suspends keeps its address until it ends, whatever later responses get.
// - Remix writes one file list into the build, with paths. `manifestForBase` keeps one more copy of it per address.
import { AsyncLocalStorage } from "node:async_hooks"

import { manifestAt, setServerAssetBase } from "../utils/asset-url.ts"
import { onShutdown } from "./lifecycle.server.ts"
import { gauge } from "./metrics/registry.server.ts"

const rendering = new AsyncLocalStorage<string>()
setServerAssetBase(() => rendering.getStore() ?? "")

export const ASSET_PROBE = {
	INTERVAL_MS: 10_000,
	TIMEOUT_MS: 2_000,
	FAILURES_TO_ORIGIN: 3,
	SUCCESS_MS_TO_STATIC: 120_000,
}

type Mode = "auto" | "static" | "origin"
type Settings = { mode: Mode; base: string; host: string }
export function assetSettings(
	env: Record<string, string | undefined>,
	warn: (line: string) => void = console.warn,
): Settings {
	const value = env.STATIC_ASSETS ?? "origin"
	let mode: Mode = "origin"
	if (value === "auto" || value === "static" || value === "origin") mode = value
	else
		warn(`Unknown STATIC_ASSETS value ${JSON.stringify(value)}; using origin`)
	let base = ""
	let host = ""
	const setting = env.STATIC_ASSETS_HOST?.trim() ?? ""
	if (setting) {
		try {
			const authority = setting.replace(/^https?:\/\//i, "").replace(/\/$/, "")
			const url = new URL(
				setting.includes("://") ? setting : `https://${setting}`,
			)
			if (
				!/^https?:$/.test(url.protocol) ||
				!url.hostname ||
				url.username ||
				url.password ||
				url.pathname !== "/" ||
				url.search ||
				url.hash ||
				authority.includes("/") ||
				/[\\\s?#]/.test(setting)
			)
				throw new Error("Expected a hostname or origin")
			// `host` and `origin` leave out a default port, as a request's `Host` does.
			host = url.host
			base = url.origin
		} catch {
			/* An invalid destination must never appear in a page. */
		}
	}
	if (!base && mode !== "origin") {
		warn("STATIC_ASSETS_HOST is empty or invalid; using origin")
		mode = "origin"
	}
	if (env.NODE_ENV !== "production") mode = "origin"
	return { mode, base, host }
}

export function createAssetAddress(options: {
	mode: Mode
	base: string
	now?: () => number
	log?: (line: string) => void
}) {
	const now = options.now ?? Date.now
	const log = options.log ?? console.info
	let usingStatic = options.mode === "static"
	let first = true
	let failures = 0
	let successSince: number | undefined
	const switchTo = (next: boolean, reason: string) => {
		if (usingStatic === next) return
		usingStatic = next
		failures = 0
		successSince = undefined
		log(`Static assets switched to ${next ? "static" : "origin"}: ${reason}`)
	}
	return {
		base: () => (usingStatic ? options.base : ""),
		usesStatic: () => usingStatic,
		report(ok: boolean) {
			if (options.mode !== "auto") return
			if (first) {
				first = false
				if (ok) switchTo(true, "first probe succeeded")
				return
			}
			if (usingStatic) {
				failures = ok ? 0 : failures + 1
				if (failures >= ASSET_PROBE.FAILURES_TO_ORIGIN)
					switchTo(false, "3 consecutive probe failures")
			} else if (!ok) successSince = undefined
			else {
				successSince ??= now()
				if (now() - successSince >= ASSET_PROBE.SUCCESS_MS_TO_STATIC)
					switchTo(true, "2 minutes of successful probes")
			}
		},
	}
}

/** Read the body inside the same timeout as the headers. */
export async function probeAsset(
	url: string,
	fetcher: typeof fetch = fetch,
): Promise<boolean> {
	try {
		const response = await fetcher(url, {
			method: "GET",
			signal: AbortSignal.timeout(ASSET_PROBE.TIMEOUT_MS),
			redirect: "error",
			headers: { "User-Agent": "goodwatch-asset-probe" },
		})
		await response.arrayBuffer()
		return (
			response.status === 200 &&
			response.headers.has("Access-Control-Allow-Origin")
		)
	} catch {
		return false
	}
}

export function createAssetProbe(
	settings: Pick<Settings, "mode" | "base">,
	address: Pick<ReturnType<typeof createAssetAddress>, "report">,
	options: {
		fetch?: typeof fetch
		schedule?: (run: () => void, ms: number) => () => void
		shutdown?: typeof onShutdown
	} = {},
) {
	let started = false
	let stopped = false
	let cancel: (() => void) | undefined
	const schedule =
		options.schedule ??
		((run, ms) => {
			const timer = setTimeout(run, ms).unref()
			return () => clearTimeout(timer)
		})
	return async (path: string): Promise<void> => {
		if (started || settings.mode !== "auto") return
		started = true
		const shutdown = options.shutdown ?? onShutdown
		shutdown("asset probe", () => {
			stopped = true
			cancel?.()
		})
		const run = async () => {
			if (stopped) return
			address.report(await probeAsset(settings.base + path, options.fetch))
			// Schedule only after the body finishes so probes cannot overlap.
			if (!stopped) cancel = schedule(() => void run(), ASSET_PROBE.INTERVAL_MS)
		}
		await run()
	}
}

const key = Symbol.for("goodwatch.asset-address")
const shared = globalThis as typeof globalThis & {
	[key]?: {
		settings: Settings
		address: ReturnType<typeof createAssetAddress>
		start: ReturnType<typeof createAssetProbe>
	}
}
if (!shared[key]) {
	const settings = assetSettings(process.env)
	const address = createAssetAddress(settings)
	shared[key] = {
		settings,
		address,
		start: createAssetProbe(settings, address),
	}
	gauge(
		"goodwatch_static_assets_in_use",
		"Whether new pages name the static hostname for their files (1) or the site's own host (0).",
		["mode"],
		() => [{ labels: [settings.mode], value: Number(address.usesStatic()) }],
	)
}
const singleton = shared[key]

export function currentAssetBase(): string {
	return singleton.address.base()
}

export function isStaticHost(
	hostHeader: string | undefined,
	host = singleton.settings.host,
): boolean {
	return !!host && hostHeader?.toLowerCase() === host
}

export const startAssetProbe = singleton.start

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
