// Renders the score emojis (gw_score_1 to gw_score_10) to scripts/discord-emojis/*.png and, with --upload, adds the
// missing ones to the bot's application emojis.
//
//   node scripts/discord-emojis.ts              render the PNGs
//   node scripts/discord-emojis.ts --dry-run    render and list what an upload would add; no network
//   DISCORD_APP_ID=… DISCORD_BOT_TOKEN=… node scripts/discord-emojis.ts --upload
//
// The upload skips names that already exist, so it is safe to run again. The bot reads the emoji IDs at runtime
// (app/server/discord/emoji.server.ts): every five minutes until all ten exist, then every 24 hours.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"
import {
	SCORE_EMOJI_COLORS,
	scoreEmojiSvg,
} from "../app/server/discord/score-emoji.ts"
import { listApplicationEmojis } from "../app/server/discord/emoji.server.ts"

const folder = join(dirname(fileURLToPath(import.meta.url)), "discord-emojis")

function render() {
	mkdirSync(folder, { recursive: true })
	return Object.keys(SCORE_EMOJI_COLORS).map((band) => {
		const name = `gw_score_${band}`
		const png = new Resvg(scoreEmojiSvg(Number(band)), {
			fitTo: { mode: "width", value: 128 },
		})
			.render()
			.asPng()
		const path = join(folder, `${name}.png`)
		writeFileSync(path, png)
		return { name, path, bytes: png.length }
	})
}

async function main() {
	const upload = process.argv.includes("--upload")
	const dryRun = process.argv.includes("--dry-run")
	const emojis = render()
	for (const e of emojis) console.log(`Rendered ${e.name} (${e.bytes} bytes)`)
	if (dryRun) {
		console.log(
			`Dry run: --upload would add any of ${emojis.length} emojis that the application doesn't have yet.`,
		)
		return
	}
	if (!upload) return
	const app = process.env.DISCORD_APP_ID
	const botToken = process.env.DISCORD_BOT_TOKEN
	if (!app || !botToken)
		throw new Error("DISCORD_APP_ID and DISCORD_BOT_TOKEN are required")
	const existing = new Set(
		(await listApplicationEmojis(app, botToken)).map((e) => e.name),
	)
	for (const e of emojis) {
		if (existing.has(e.name)) {
			console.log(`Skipped ${e.name}: already uploaded`)
			continue
		}
		const response = await fetch(
			`https://discord.com/api/v10/applications/${encodeURIComponent(app)}/emojis`,
			{
				method: "POST",
				headers: {
					Authorization: `Bot ${botToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: e.name,
					image: `data:image/png;base64,${readFileSync(e.path).toString("base64")}`,
				}),
				signal: AbortSignal.timeout(10_000),
			},
		)
		if (!response.ok)
			throw new Error(
				`Upload of ${e.name} failed with Discord REST status ${response.status}`,
			)
		console.log(`Uploaded ${e.name}`)
	}
	console.log("Done. The bot picks up the new emoji IDs within five minutes.")
}
try {
	await main()
	process.exit(0)
} catch (error) {
	console.error(error instanceof Error ? error.message : "Emoji script failed")
	process.exit(1)
}
