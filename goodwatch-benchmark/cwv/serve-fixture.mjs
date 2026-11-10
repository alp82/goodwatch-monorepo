// TLS/H2 SSR preview of frozen anonymous payloads. No .env, production entry, real loader or outbound socket.
// env -i PATH="$PATH" NODE_ENV=production node serve-fixture.mjs BUILD APP PAYLOAD PORT KEY CERT
import http2 from "node:http2";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { brotliCompressSync } from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { denyOutboundConnections } from "./fixture-safety.mjs";
import { fixtureApiResponse, validateApiFixtures } from "./fixture-api.mjs";

const [buildArg, appArg, payloadArg, portArg, keyFile, certFile] =
	process.argv.slice(2);
const build = path.resolve(buildArg);
const app = path.resolve(appArg);
const payload = path.resolve(payloadArg);
const port = Number(portArg);
if (!port || !keyFile || !certFile)
	throw new Error("Expected BUILD APP PAYLOAD PORT KEY CERT");
for (const name of Object.keys(process.env))
	if (!new Set(["PATH", "NODE_ENV", "CWV_ASSET_BASE"]).has(name))
		delete process.env[name];
process.env.NODE_ENV = "production";

// Install the deny rule before importing any application or framework runtime. Listening/accepting is unaffected.
denyOutboundConnections();

globalThis.__CWV_FIXTURES__ = JSON.parse(await readFile(payload, "utf8"));
const apiFixtures = validateApiFixtures(
	JSON.parse(
		await readFile(
			path.join(path.dirname(payload), "api-responses.json"),
			"utf8",
		),
	),
);
globalThis.__CWV_ASSET_BASE__ = process.env.CWV_ASSET_BASE || "";
for (const data of Object.values(globalThis.__CWV_FIXTURES__)) {
	if (!data.root || data.root.user !== null)
		throw new Error("Fixtures must be anonymous root loader payloads");
	data.root.env.SUPABASE_URL = "https://fixture.invalid";
	data.root.env.SUPABASE_ANON_KEY = "fixture-public-key";
	data.root.env.FASTSTATS_SITE_KEY = "";
}
const require = createRequire(path.join(app, "package.json"));
const { createRequestHandler } = require("@remix-run/node");
const serverBuild = await import(
	pathToFileURL(path.join(build, "server/index.js")).href
);
const handler = createRequestHandler(serverBuild, "production");
const hintLinks = serverBuild.entry.module.fixtureHints;
const mime = {
	".js": "text/javascript",
	".css": "text/css",
	".avif": "image/avif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".png": "image/png",
	".json": "application/json",
	".webmanifest": "application/manifest+json",
	".ico": "image/x-icon",
};
const compressed = new Map();
async function reply(response, status, headers, bytes, request) {
	if (
		/br/.test(request.headers["accept-encoding"] || "") &&
		/text|javascript|json|svg/.test(headers["content-type"] || "")
	) {
		const key = request.url + ":" + bytes.length;
		if (!compressed.has(key)) compressed.set(key, brotliCompressSync(bytes));
		bytes = compressed.get(key);
		headers["content-encoding"] = "br";
		headers.vary = "Accept-Encoding";
	}
	headers["content-length"] = String(bytes.length);
	headers["access-control-allow-origin"] = "*";
	response.writeHead(status, headers);
	response.end(request.method === "HEAD" ? undefined : bytes);
}
const server = http2.createSecureServer({
	key: readFileSync(keyFile),
	cert: readFileSync(certFile),
	allowHTTP1: true,
});
server.on("request", async (request, response) => {
	try {
		if (!["GET", "HEAD"].includes(request.method))
			return reply(
				response,
				405,
				{ "content-type": "text/plain" },
				Buffer.from("Fixture forbids writes"),
				request,
			);
		const pathname = new URL(request.url, `https://127.0.0.1:${port}`).pathname;
		if (pathname.startsWith("/api/")) {
			const api = fixtureApiResponse(request.url, apiFixtures);
			if (api.status === 404)
				console.error(`No frozen API response: ${request.url}`);
			return reply(
				response,
				api.status,
				{ "content-type": "application/json" },
				Buffer.from(api.body),
				request,
			);
		}
		if (pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(pathname)) {
			const root = pathname.startsWith("/assets/")
				? path.join(build, "client")
				: path.join(app, "public");
			const file = path.resolve(root, "." + pathname);
			if (!file.startsWith(root + path.sep))
				throw new Error("Invalid asset path");
			const bytes = await readFile(file);
			return reply(
				response,
				200,
				{
					"content-type":
						mime[path.extname(file)] || "application/octet-stream",
					"cache-control": "public,max-age=31536000,immutable",
				},
				bytes,
				request,
			);
		}
		if (!Object.hasOwn(globalThis.__CWV_FIXTURES__, pathname))
			return reply(
				response,
				404,
				{ "content-type": "text/plain" },
				Buffer.from("No frozen page"),
				request,
			);
		const links = hintLinks(
			{ method: request.method, url: request.url, headers: request.headers },
			globalThis.__CWV_ASSET_BASE__,
		);
		if (links.length) {
			if (request.httpVersionMajor === 2)
				response.stream.additionalHeaders({ ":status": 103, link: links });
			else response.writeEarlyHints({ link: links });
		}
		const headers = new Headers();
		for (const [name, value] of Object.entries(request.headers))
			if (!name.startsWith(":"))
				headers.set(name, Array.isArray(value) ? value.join(",") : value || "");
		const result = await handler(
			new Request(`https://127.0.0.1:${port}${request.url}`, {
				headers,
				method: request.method,
			}),
		);
		const replyHeaders = Object.fromEntries(result.headers);
		delete replyHeaders["set-cookie"];
		await reply(
			response,
			result.status,
			replyHeaders,
			Buffer.from(await result.arrayBuffer()),
			request,
		);
	} catch (error) {
		console.error(error);
		if (!response.headersSent)
			response.writeHead(500, { "content-type": "text/plain" });
		response.end("Fixture failed");
	}
});
server.listen(port, "127.0.0.1", () =>
	console.log(
		`Fixture ready https://127.0.0.1:${port}; outbound connections denied`,
	),
);
