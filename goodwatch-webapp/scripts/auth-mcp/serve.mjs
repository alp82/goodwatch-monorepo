import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
const dir = resolve(
	process.env.MCP_LOCAL_STATE_DIR ?? "scripts/auth-mcp/results",
)
mkdirSync(dir, { recursive: true, mode: 0o700 })
const file = `${dir}/member.json`
if (!existsSync(file))
	writeFileSync(
		file,
		JSON.stringify({
			email: "mcp-local-566@example.test",
			password: randomBytes(24).toString("base64url"),
		}),
		{ mode: 0o600 },
	)
const fixture = JSON.parse(readFileSync(file, "utf8"))
if (!process.env.AUTH_TEST_VALKEY_NAT)
	throw new Error("Local Valkey NAT required")
const env = Object.fromEntries(
	["PATH", "HOME", "USER", "XDG_RUNTIME_DIR"]
		.filter((k) => process.env[k])
		.map((k) => [k, process.env[k]]),
)
Object.assign(env, {
	NODE_ENV: "development",
	GOODWATCH_LOCAL_MCP: "566",
	BETTER_AUTH_ENABLED: "true",
	BETTER_AUTH_SECRET: "local-mcp-secret-at-least-32-characters",
	MCP_RESOURCE_URL: "http://127.0.0.1:3356/mcp",
	MCP_LOCAL_CREDENTIAL_FILE: file,
	AUTH_TEST_VALKEY_NAT: process.env.AUTH_TEST_VALKEY_NAT,
	CRATE_HOSTS: "127.0.0.1",
	CRATE_PORT: "15548",
	CRATE_USER: "crate",
	CRATE_PASS: "",
	REDIS_HOST: "",
	TASTE_REDIS_URL: "redis://127.0.0.1:15604",
	TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:15604",
	PAGE_CACHE_ENABLED: "false",
	SENTRY_DISABLE_AUTO_UPLOAD: "true",
	DOCKER_HOST: `unix:///run/user/${process.getuid()}/docker.sock`,
})
const app = spawn(
	process.execPath,
	[
		"node_modules/@remix-run/dev/dist/cli.js",
		"vite:dev",
		"--config",
		"scripts/auth-mcp/vite.config.ts",
	],
	{ env, stdio: "inherit" },
)
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, () => app.kill(signal))
app.on("exit", (code) => process.exit(code ?? 1))
console.log(`Local #566 credential file (mode 0600): ${file}`)
