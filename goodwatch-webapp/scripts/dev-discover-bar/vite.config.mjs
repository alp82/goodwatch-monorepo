// Development only, used by dev-discover-bar.sh: the app's Vite config plus a dev server proxy that answers the
// Discover bar's read requests from the live site as a guest (no cookies), so /dev/discover-bar has real titles and
// counts without local databases. Only reads pass: GET, and POST for the endpoints that take a guest body. Vite's
// proxy exists only in the dev server; nothing here reaches a production build.
import { mergeConfig } from "vite"
import base from "../../vite.config.js"

const LIVE = "https://goodwatch.app"

// Prototype branch only: the machine is out of inotify watchers (fs.inotify.max_user_watches), so every watcher in
// this process polls, the Remix child compiler's included.
process.env.CHOKIDAR_USEPOLLING = "1"
process.env.CHOKIDAR_INTERVAL = "1000"

/** Path pattern, and the methods it may use. */
const READS = [
	["^/api/discover/(results|panel)(\\?|$)", ["GET", "POST"]],
	["^/api/combined-search(\\?|$)", ["POST"]],
	["^/api/search(\\?|$)", ["GET"]],
	["^/api/cast(\\?|$)", ["GET"]],
	["^/api/similar-media(\\?|$)", ["GET"]],
	["^/api/streaming-providers(\\?|$)", ["GET"]],
	["^/api/countries(\\?|$)", ["GET"]],
	["^/api/explorer/world(\\?|$)", ["GET", "POST"]],
	["^/api/discover/interpret(\\?|$)", ["POST"]],
]

const proxy = Object.fromEntries(
	READS.map(([path, methods]) => [
		path,
		{
			target: LIVE,
			changeOrigin: true,
			secure: true,
			// Anything but a read gets a 404 from the dev server instead.
			bypass: (req) => (methods.includes(req.method ?? "") ? undefined : false),
			configure: (server) =>
				server.on("proxyReq", (request) => {
					request.removeHeader("cookie")
					request.removeHeader("authorization")
					request.setHeader("origin", LIVE)
					request.setHeader("user-agent", "goodwatch-dev-discover-bar")
				}),
		},
	]),
)

export default async (env) =>
	mergeConfig(await base(env), {
		// Prototype branch only: the preview is served through tailscale serve.
		server: {
			proxy,
			allowedHosts: ["alppc", "alppc.tail3b99f1.ts.net"],
			watch: { usePolling: true, interval: 1000, binaryInterval: 3000 },
		},
	})
