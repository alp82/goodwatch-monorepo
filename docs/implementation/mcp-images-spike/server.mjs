import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

// Fixture data only. No production API, database, OAuth, or member data.
const items = [
  { id: "movie:603", name: "The Matrix", year: 1999, url: "https://goodwatch.app/movie/603-the-matrix", poster_url: "https://image.tmdb.org/t/p/w185/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg" },
  { id: "movie:27205", name: "Inception", year: 2010, url: "https://goodwatch.app/movie/27205-inception", poster_url: "https://image.tmdb.org/t/p/w185/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg" },
];
const resourceUri = "ui://goodwatch/posters-v1.html";
const html = await readFile(new URL("./dist/widget.html", import.meta.url), "utf8");
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "goodwatch-posters-local-spike", version: "0.0.1" });
  registerAppTool(server, "poster_spike", {
    description: "Show two fixed movie posters. Local research fixture only.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri } },
  }, async () => ({
    content: [{ type: "text", text: items.map((x) => `- [${x.name} (${x.year})](${x.url})`).join("\n") + "\nSee it on GoodWatch: [Discover](https://goodwatch.app/discover)" }],
    structuredContent: { items, page_url: "https://goodwatch.app/discover" },
  }));
  registerAppResource(server, "GoodWatch posters", resourceUri, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html,
      _meta: { ui: { csp: { resourceDomains: ["https://image.tmdb.org"], connectDomains: [] } } },
    }],
  }));
  return server;
}, { legacy: "stateless" });

const http = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:18080");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version, mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.url !== "/mcp") { res.writeHead(404).end(); return; }
  try {
    const init = { method: req.method, headers: req.headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req); init.duplex = "half";
    }
    const response = await handler.fetch(new Request("http://127.0.0.1:3001/mcp", init));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch (error) { console.error(error); res.writeHead(500).end(); }
});
http.listen(3001, "127.0.0.1", () => console.log("Local fixture MCP: http://127.0.0.1:3001/mcp"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  await handler.close(); http.close();
});
