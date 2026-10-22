import { rateLimiter } from "../rate-limit.server.ts"
export const discordWindows = [
	{ limit: 30, seconds: 60 },
	{ limit: 500, seconds: 3600 },
]
export const takeDiscordLimit = (userId: string) =>
	rateLimiter.take("discord", userId, discordWindows)
