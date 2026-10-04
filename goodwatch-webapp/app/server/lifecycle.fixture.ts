// A stand-in server build for lifecycle.test.ts: `remix-serve` imports this file as it imports build/server/index.js,
// so the test runs the real signal handling of `remix-serve` without building the app. It has two resource routes and
// what the app has in the background: a timer that would keep the process alive, and a readiness check.
import {
	addReadinessCheck,
	onShutdown,
	startLifecycle,
} from "./lifecycle.server.ts"

// FIXTURE_LIFECYCLE=off shows `remix-serve` alone: it stops listening on SIGTERM and never exits.
if (process.env.FIXTURE_LIFECYCLE !== "off") startLifecycle()

const timer = setInterval(() => {}, 1_000)
onShutdown("fixture timer", () => {
	clearInterval(timer)
	console.log("fixture: timer stopped")
})

const readyAt = Date.now() + Number(process.env.FIXTURE_READY_AFTER_MS ?? 0)
addReadinessCheck("fixture", () => Date.now() >= readyAt)

const route = (
	path: string,
	loader: (request: Request) => Promise<Response>,
) => ({
	id: `routes/${path}`,
	parentId: undefined,
	path,
	index: undefined,
	caseSensitive: undefined,
	module: { loader: ({ request }: { request: Request }) => loader(request) },
})

export const routes = {
	"routes/slow": route("slow", async (request) => {
		const ms = Number(new URL(request.url).searchParams.get("ms") ?? 0)
		await new Promise((resolve) => setTimeout(resolve, ms))
		return new Response("done")
	}),
	"routes/fast": route("fast", async () => new Response("ok")),
}
export const entry = { module: { default: () => new Response("unused") } }
export const assets = {
	version: "fixture",
	url: "/assets/manifest.js",
	entry: { module: "/assets/entry.js", imports: [] },
	routes: {},
}
export const mode = "production"
export const publicPath = "/assets/"
export const assetsBuildDirectory = "build/client"
export const basename = "/"
export const future = {}
export const isSpaMode = false
