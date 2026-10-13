// PROTOTYPE - throwaway. Puts the local preview of /prototype/media-language on this machine's Tailscale address, so
// another device of the same tailnet (a phone) can open it, without the site's analytics leaving that device.
//   node tailnet-preview.mjs <tailscale ip of this machine> [listen port, default 3118] [dev server port, default 3117]
//
// Why not just bind the dev server to the tailnet: the app shell turns its analytics off only on the host name
// "localhost". Under any other name it would send this prototype's page views to the real Google Analytics, PostHog
// and Sentry projects. This proxy is the one place that stops them, and it changes nothing in the app:
// - PostHog and Sentry: their two browser modules are answered with 404, so they never start (the shell loads them
//   with a caught dynamic import). The Sentry tunnel /api/e is answered here and never forwarded.
// - Google: the shell's own "is this localhost" switch is rewritten to true in the page and in the module that holds
//   it, and the tag's script is never added.
// It listens on the Tailscale address only, so nothing outside the tailnet reaches it.
import http from "node:http"
import net from "node:net"

const [listenHost, listenPort = "3118", upstreamPort = "3117"] = process.argv.slice(2)
if (!listenHost) throw new Error("Pass this machine's Tailscale address, see `tailscale ip -4`.")
const UPSTREAM = { host: "::1", port: Number(upstreamPort) }
const upstreamName = `localhost:${upstreamPort}`

const BLOCKED_MODULE = /^\/app\/telemetry\/(posthog-browser|sentry-browser)\.ts/
const LOCALHOST_SWITCH = "['localhost', '127.0.0.1'].includes(location.hostname)"
const rewrite = (text) => text.split(LOCALHOST_SWITCH).join("true").split("document.head.appendChild(script)").join("void script")

const server = http.createServer((req, res) => {
	const path = new URL(req.url, "http://x").pathname
	if (path === "/api/e") return res.writeHead(204).end()
	if (BLOCKED_MODULE.test(path)) return res.writeHead(404, { "content-type": "text/plain" }).end("Analytics are off in the tailnet preview.")
	const proxied = http.request({ ...UPSTREAM, method: req.method, path: req.url, headers: { ...req.headers, host: upstreamName, "accept-encoding": "identity" } }, (up) => {
		const type = String(up.headers["content-type"] ?? "")
		if (!type.includes("text/html") && path !== "/app/telemetry/google-tag.ts") {
			res.writeHead(up.statusCode, up.headers)
			return up.pipe(res)
		}
		const chunks = []
		up.on("data", (c) => chunks.push(c))
		up.on("end", () => {
			const body = Buffer.from(rewrite(Buffer.concat(chunks).toString("utf8")))
			const headers = { ...up.headers, "content-length": body.length }
			delete headers["transfer-encoding"]
			res.writeHead(up.statusCode, headers).end(body)
		})
	})
	proxied.on("error", (e) => res.writeHead(502, { "content-type": "text/plain" }).end(`The preview server on ${upstreamName} does not answer: ${e.message}`))
	req.pipe(proxied)
})

// The dev server's own socket (it tells an open page when the server restarts) passes through untouched.
server.on("upgrade", (req, socket, head) => {
	const up = net.connect(UPSTREAM, () => {
		const headers = Object.entries({ ...req.headers, host: upstreamName }).map(([k, v]) => `${k}: ${v}`)
		up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`)
		up.write(head)
		socket.pipe(up).pipe(socket)
	})
	up.on("error", () => socket.destroy())
	socket.on("error", () => up.destroy())
})

server.listen(Number(listenPort), listenHost, () => console.log(`tailnet preview: http://${listenHost}:${listenPort}/prototype/media-language -> ${upstreamName}, analytics blocked`))
