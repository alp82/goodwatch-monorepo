import { fileURLToPath } from "node:url"
import { vitePlugin as remix } from "@remix-run/dev"
import { defineConfig } from "vite"
export default defineConfig({
	// The full-app browser drive runs from the same root with a different dependency graph.
	cacheDir: "node_modules/.vite-auth-mcp",
	envDir: "/tmp/goodwatch-auth-mcp-no-dotenv",
	resolve: {
		alias: { "~": fileURLToPath(new URL("../../app", import.meta.url)) },
	},
	plugins: [
		remix({
			appDirectory: "scripts/auth-mcp/app",
			routes(defineRoutes) {
				return defineRoutes((route) => {
					route("mcp", "../../../app/routes/mcp.ts")
					route("api/auth/*", "routes/api.auth.$.ts")
					route("sign-in", "../../../app/routes/sign-in.tsx")
					route("auth/mcp/consent", "../../../app/routes/auth.mcp.consent.tsx")
					route(
						".well-known/oauth-protected-resource/*",
						"../../../app/routes/[.well-known].oauth-protected-resource.$.ts",
					)
					route(
						".well-known/oauth-authorization-server/*",
						"../../../app/routes/[.well-known].oauth-authorization-server.$.ts",
					)
					route(
						".well-known/openid-configuration/*",
						"../../../app/routes/[.well-known].openid-configuration.$.ts",
					)
				})
			},
		}),
		{
			name: "local-auth-audit",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const path = req.url?.split("?")[0]
					res.on("finish", () => {
						if (path?.startsWith("/api/auth/") || path === "/mcp")
							console.log(
								JSON.stringify({
									event: "local-auth-http",
									path,
									status: res.statusCode,
								}),
							)
					})
					next()
				})
			},
		},
	],
	server: { host: "127.0.0.1", port: 3356, strictPort: true },
})
