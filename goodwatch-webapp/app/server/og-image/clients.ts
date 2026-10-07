import { isbot } from "isbot"

export type CardClient = "preview" | "crawler" | "other"

// For counting only: storing does not depend on the client, because an undeclared crawler can send any User-Agent.
const preview =
	/facebookexternalhit|Facebot|WhatsApp|Slackbot|Slack-ImgProxy|Twitterbot|Discordbot|TelegramBot|LinkedInBot|Pinterestbot|Pinterest\/|redditbot|Mastodon|Bluesky|Signal|SkypeUriPreview|MicrosoftPreview|Iframely|Embedly|vkShare|Viber|Snapchat/i

export function cardClient(userAgent: string | null | undefined): CardClient {
	if (!userAgent) return "other"
	if (preview.test(userAgent)) return "preview"
	return isbot(userAgent) ? "crawler" : "other"
}
