import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

test("plain Node registration loads the shared budget and sends only the stubbed command PUT", () => {
	// Replace the transport before loading the CLI, but exercise its real lazy budget/cache imports. The child
	// receives no inherited app secrets, REDIS_HOST or NODE_OPTIONS, so no external service can be contacted.
	const preload = `
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
 if (specifier.endsWith('/native-fetch.server.ts')) return {
  shortCircuit: true,
  url: 'data:text/javascript,' + encodeURIComponent(\`export const nativeFetch = async (url, init) => {
   if (url !== 'https://discord.com/api/v10/applications/test-app/commands' || init.method !== 'PUT') throw new Error('Unexpected request');
   if (JSON.parse(init.body).length !== 14) throw new Error('Missing commands');
   return new Response(null, {status: 204});
  }\`)
 };
 return next(specifier, context);
}});
`
	const run = spawnSync(
		process.execPath,
		[
			"--import",
			`data:text/javascript,${encodeURIComponent(preload)}`,
			"scripts/discord-register.ts",
		],
		{
			cwd: new URL("../", import.meta.url),
			env: {
				PATH: process.env.PATH,
				DISCORD_APP_ID: "test-app",
				DISCORD_BOT_TOKEN: "test-token",
			},
			encoding: "utf8",
			timeout: 15_000,
		},
	)
	assert.equal(run.status, 0, run.stderr)
	assert.match(run.stdout, /Registered Discord commands/)
	assert.doesNotMatch(run.stdout + run.stderr, /test-token/)
})
