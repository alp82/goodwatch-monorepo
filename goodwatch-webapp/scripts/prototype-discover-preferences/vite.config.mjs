// PROTOTYPE - throwaway, used by prototype-discover-preferences.sh. The app's Vite config plus a dev server proxy with
// a short read-only allowlist:
// - /__prototype-v7/api/{config,search,cards} -> the local read-only V7 preview service (127.0.0.1:5219).
// - Discover's guest reads from goodwatch.app, without cookies: results (POST carries only the guest body and the
//   ranked keys), panel content (POST likewise: the guest body, read-only), providers and countries.
// Deliberately NOT here: /api/combined-search (writes search history), /api/discover/interpret (the prototype reads
// the query with the V7 service instead), /api/search, and every other endpoint. Anything else under /api answers from
// this dev server, which has no databases. Vite's proxy exists only in the dev server.
import { mergeConfig } from "vite"
import base from "../../vite.config.js"

const LIVE = "https://goodwatch.app"
const V7 = process.env.V7_PREVIEW_URL || "http://127.0.0.1:5219"

const READS = [
	["^/api/discover/results(\\?|$)", ["GET", "POST"]],
	["^/api/discover/panel(\\?|$)", ["GET", "POST"]],
	["^/api/streaming-providers(\\?|$)", ["GET"]],
	["^/api/countries(\\?|$)", ["GET"]],
]

const strip = (server) =>
	server.on("proxyReq", (request) => {
		request.removeHeader("cookie")
		request.removeHeader("authorization")
		request.setHeader("user-agent", "goodwatch-prototype-discover-preferences")
	})

const proxy = {
	...Object.fromEntries(
		READS.map(([path, methods]) => [
			path,
			{
				target: LIVE,
				changeOrigin: true,
				secure: true,
				bypass: (req) => (methods.includes(req.method ?? "") ? undefined : false),
				configure: (server) => {
					strip(server)
					server.on("proxyReq", (request) => request.setHeader("origin", LIVE))
				},
			},
		]),
	),
	"^/__prototype-v7/api/(config|search|cards)$": {
		target: V7,
		changeOrigin: true,
		rewrite: (path) => path.replace(/^\/__prototype-v7/, ""),
		bypass: (req) => (["GET", "POST"].includes(req.method ?? "") ? undefined : false),
		// The preview accepts only its own origin (or none): the browser's 127.0.0.1:5220 origin is dropped here.
		configure: (server) => {
			strip(server)
			server.on("proxyReq", (request) => request.removeHeader("origin"))
		},
	},
}

// Its own dependency cache: node_modules is a symlink shared with another worktree's dev server.
const cacheDir = new URL("./.vite-cache", import.meta.url).pathname

export default async (env) => mergeConfig(await base(env), { cacheDir, server: { proxy } })
