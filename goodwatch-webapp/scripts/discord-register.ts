import { commands } from "../app/server/discord/commands.ts"
import { discordRest } from "../app/server/discord/rest.server.ts"
import { existsSync } from "node:fs"
import * as nodeModule from "node:module"
import { fileURLToPath } from "node:url"

// The live REST budget reuses the app's Valkey cache. Resolve its app imports when this operator script runs
// directly under Node, as measure-newly-available.mjs does, without starting Vite or loading an env file.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (context.parentURL?.includes("/node_modules/"))
			return next(specifier, context)
		const path = specifier.startsWith("~/")
			? new URL(specifier.slice(2), new URL("../app/", import.meta.url))
			: specifier.startsWith(".") && context.parentURL
				? new URL(specifier, context.parentURL)
				: null
		if (path && existsSync(`${fileURLToPath(path)}.ts`))
			return next(`${path.href}.ts`, context)
		return next(specifier, context)
	},
})

async function register() {
	const dryRun = process.argv.includes("--dry-run")
	const app = process.env.DISCORD_APP_ID
	const botToken = process.env.DISCORD_BOT_TOKEN
	if (!dryRun && (!app || !botToken))
		throw new Error("DISCORD_APP_ID and DISCORD_BOT_TOKEN are required")
	console.log(JSON.stringify(commands, null, 2))
	if (dryRun) return
	await discordRest({ botToken }).request(
		"PUT",
		`/applications/${encodeURIComponent(app!)}/commands`,
		commands,
		true,
	)
	console.log("Registered Discord commands.")
}
try {
	await register()
	process.exit(0)
} catch (error) {
	console.error(
		error instanceof Error ? error.message : "Command registration failed",
	)
	process.exit(1)
}
