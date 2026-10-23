import { commands } from "../app/server/discord/commands.ts"
import { discordRest } from "../app/server/discord/rest.server.ts"

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
