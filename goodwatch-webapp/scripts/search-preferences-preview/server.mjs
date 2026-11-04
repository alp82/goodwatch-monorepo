// Local-only comparison harness. No Remix boot, sessions, history, or background jobs.
import { createServer as createHttpServer } from "node:http"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { createServer, loadEnv } from "vite"

const directory = fileURLToPath(new URL("./", import.meta.url))
const root = resolve(directory, "../..")
const envDirectory = process.env.GOODWATCH_PREVIEW_ENV_DIR || root
Object.assign(process.env, { ...loadEnv("development", envDirectory, ""), ...process.env })
const port = Number(process.env.SEARCH_PREFERENCES_PORT || 5219)
const vite = await createServer({
  configFile: false,
  root,
  envFile: false,
  appType: "custom",
  resolve: { alias: { "~": resolve(root, "app") } },
  plugins: [{
    name: "preview-demand-only-availability",
    enforce: "pre",
    transform(code, id) {
      if (!id.split("?")[0].endsWith("/app/server/availability-index.server.ts")) return
      // Prevent the startup sweep over member countries. Explicit service filters still load on demand.
      const eagerCall = "\npreloadAvailability()\n"
      if (!code.includes(eagerCall)) throw Error("Availability startup guard no longer matches the source.")
      return { code: code.replace(eagerCall, "\n// Local preview: no eager availability warm-up.\n"), map: null }
    },
  }],
  server: { middlewareMode: true, hmr: false, ws: false },
})
let engine, configuration, failure, busy = false
const examples = [
  { query: "Historical Action", label: "Historical action" },
  { query: "historical films about musicians", label: "Historical musicians" },
  { query: "true stories horror", label: "True-story horror" },
  { query: "historical action without warfare", label: "Explicit exclusion" },
  { query: "The Big Short", label: "Exact title" },
  { query: "1917", label: "1917" },
]
const json = (res, status, value) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
  res.end(JSON.stringify(value))
}
async function input(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw Error("Send JSON.")
  let text = ""
  for await (const chunk of req) {
    text += chunk
    if (text.length > 32768) throw Error("Request is too large.")
  }
  return JSON.parse(text)
}
const staticFiles = new Map([
  ["/", ["index.html", "text/html"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/style.css", ["style.css", "text/css"]],
])
const server = createHttpServer(async (req, res) => {
  const host = req.headers.host
  const allowedHosts = ["localhost:" + port, "127.0.0.1:" + port]
  if (!allowedHosts.includes(host)) return json(res, 403, { error: "Local access only." })
  if (req.headers.origin && req.headers.origin !== "http://" + host) return json(res, 403, { error: "Invalid origin." })
  const path = new URL(req.url, "http://" + host).pathname
  try {
    if (req.method === "GET" && staticFiles.has(path)) {
      const [name, type] = staticFiles.get(path)
      res.writeHead(200, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
      return res.end(await readFile(resolve(directory, name)))
    }
    if (req.method === "GET" && path === "/api/config") {
      // The current index build and snapshot, not the ones from startup: the app's search index refreshes itself.
      if (configuration) configuration = await engine.initialize()
      return json(res, 200, { ready: Boolean(configuration), error: failure ?? null, ...configuration, examples })
    }
    if (req.method === "POST" && ["/api/search", "/api/cards"].includes(path)) {
      if (!configuration) return json(res, 503, { error: failure || "The catalog is still loading." })
      if (busy) return json(res, 429, { error: "A search is already running. Try again when it finishes." })
      const data = await input(req)
      if (path === "/api/cards") {
        if (!Array.isArray(data.keys) || data.keys.length > 100 || data.keys.some(k => !Number.isInteger(k) || k <= 1e12 || k >= 3e12))
          return json(res, 400, { error: "Pass up to 100 valid title keys." })
        return json(res, 200, { cards: await engine.cards([...new Set(data.keys)]) })
      }
      if (typeof data.query !== "string" || data.query.trim().length < 2 || data.query.length > 512 || (data.existing !== undefined && (typeof data.existing !== "string" || data.existing.length > 4096)))
        return json(res, 400, { error: "Enter a search between 2 and 512 characters." })
      busy = true
      try {
        return json(res, 200, await engine.search({ query: data.query.trim(), existing: data.existing || "", debug: data.debug === true }))
      } finally {
        busy = false
      }
    }
    return json(res, 404, { error: "Not found." })
  } catch (error) {
    console.error("[preview]", error instanceof Error ? error.message : "Request failed")
    return json(res, 500, { error: error instanceof Error ? error.message : "Search failed." })
  }
})
server.listen(port, "127.0.0.1", () => console.log("Search preview: http://localhost:" + port))
const boot = async () => {
  engine = await vite.ssrLoadModule(resolve(directory, "engine.ts"))
  configuration = await engine.initialize()
  console.log("Read-only preview ready.", configuration.index, configuration.snapshot)
}
boot().catch(error => { failure = error.message; console.error("[preview startup]", error.message) })
async function close() {
  server.close()
  await engine?.close?.()
  await vite.close()
  process.exit(0)
}
process.on("SIGTERM", close)
process.on("SIGINT", close)
