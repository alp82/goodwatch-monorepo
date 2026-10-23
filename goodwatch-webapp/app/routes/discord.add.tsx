// /discord/add: the short install address for the GoodWatch Discord bot. It sends people on to Discord's install
// dialog, where they choose Add to My Apps or Add to Server.
import { redirect } from "@remix-run/node"
import { DISCORD_INSTALL_URL } from "~/ui/discord-bot/links"

export const loader = () =>
	redirect(DISCORD_INSTALL_URL, {
		status: 302,
		headers: { "Cache-Control": "public, max-age=3600" },
	})
