// #533: launch only the isolated Remix app; never inherit production data credentials.
import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"

let tunnel
let child
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => {
		child?.kill(signal)
		tunnel?.kill(signal)
		if (!child) process.exit(0)
	})
let origin = process.env.MCP_SPIKE_ORIGIN || "http://127.0.0.1:3335"
if (process.argv.includes("--tunnel")) {
	tunnel = spawn(
		"cloudflared",
		["tunnel", "--url", "http://127.0.0.1:3335", "--no-autoupdate"],
		{ stdio: ["ignore", "pipe", "pipe"] },
	)
	origin = await new Promise((resolve, reject) => {
		let output = ""
		const timeout = setTimeout(() => {
			tunnel.kill()
			reject(new Error("Quick tunnel startup timed out"))
		}, 45000)
		const read = (chunk) => {
			process.stderr.write(chunk)
			output += chunk.toString()
			const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
			if (match) {
				clearTimeout(timeout)
				resolve(match[0])
			}
		}
		tunnel.stdout.on("data", read)
		tunnel.stderr.on("data", read)
		tunnel.on("error", (error) => {
			clearTimeout(timeout)
			reject(error)
		})
		tunnel.on("exit", (code) => {
			clearTimeout(timeout)
			reject(new Error(`Quick tunnel exited (${code})`))
			child?.kill("SIGTERM")
		})
	})
}
const url = new URL(origin)
if (
	url.origin !== origin ||
	!(url.hostname === "127.0.0.1" || url.hostname.endsWith(".trycloudflare.com"))
) {
	throw new Error(
		"Use http://127.0.0.1:3335 or the HTTPS quick-tunnel origin (no trailing slash)",
	)
}
if (url.hostname !== "127.0.0.1" && url.protocol !== "https:")
	throw new Error("Tunnel requires HTTPS")
const password =
	process.env.MCP_SPIKE_PASSWORD || randomBytes(18).toString("base64url")
console.log(
	`THROWAWAY MCP spike: ${origin}/mcp\nDemo login: spike@example.test\nDemo password: ${password}\nAll auth state disappears on restart.`,
)
child = spawn(
	process.execPath,
	[
		"node_modules/@remix-run/dev/dist/cli.js",
		"vite:dev",
		"--config",
		"scripts/mcp-oauth-spike.vite.ts",
	],
	{
		stdio: "inherit",
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			NODE_ENV: "development",
			MCP_SPIKE: "1",
			MCP_SPIKE_ORIGIN: origin,
			MCP_SPIKE_PASSWORD: password,
			MCP_SPIKE_SECRET: randomBytes(32).toString("base64url"),
			MCP_SPIKE_LEGACY: process.env.MCP_SPIKE_LEGACY || "stateless",
		},
	},
)
child.on("exit", (code) => {
	tunnel?.kill("SIGTERM")
	process.exit(code ?? 1)
})
