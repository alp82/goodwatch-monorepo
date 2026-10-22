import { commands } from "../app/server/discord/commands.ts"
import { discordRest } from "../app/server/discord/rest.server.ts"
console.log(JSON.stringify(commands, null, 2))
if (!process.argv.includes("--dry-run")) {
	const app = process.env.DISCORD_APP_ID
	const botToken = process.env.DISCORD_BOT_TOKEN
	if (!app || !botToken)
		throw new Error("DISCORD_APP_ID and DISCORD_BOT_TOKEN are required")
	await discordRest({ botToken }).request(
		"PUT",
		`/applications/${encodeURIComponent(app)}/commands`,
		commands,
		true,
	)
	console.log("Registered Discord commands.")
}
