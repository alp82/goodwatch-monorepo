// The instance's hero pictures (hero-hints.ts): title loaders remember theirs, and static pages name theirs here.
// The 103 Early Hints response reads both.
import {
	DISCORD_BOT_PATH,
	DISCORD_PREVIEW_BACKDROP,
} from "../ui/discord-bot/links"
import { tmdbImageUrl } from "../utils/tmdb-image"
import { HERO_PAGES, createHeroHints } from "./hero-hints"

// The Discord preview is static, so its first visit can receive the hint too.
const discordHero = tmdbImageUrl(DISCORD_PREVIEW_BACKDROP, "w780")
export const heroHints = createHeroHints(HERO_PAGES, {
	[DISCORD_BOT_PATH]: { phone: discordHero, desktop: discordHero },
})
