// Throwaway #533: a separate Remix app, with no production root or data clients.
import { vitePlugin as remix } from "@remix-run/dev"
import { defineConfig } from "vite"

export default defineConfig({
	envDir: "/tmp/goodwatch-mcp-spike-no-env",
	plugins: [remix({ appDirectory: "app/mcp-oauth-spike" })],
	server: {
		host: "127.0.0.1",
		port: 3335,
		strictPort: true,
		allowedHosts: [".trycloudflare.com"],
	},
})
