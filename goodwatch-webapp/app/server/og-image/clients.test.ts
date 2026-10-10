import assert from "node:assert/strict"
import { test } from "node:test"
import { cardClient } from "./clients.ts"

test("preview tokens take precedence over crawler detection regardless of case", () => {
	for (const token of [
		"facebookexternalhit",
		"Facebot",
		"WhatsApp",
		"Slackbot",
		"Slack-ImgProxy",
		"Twitterbot",
		"Discordbot",
		"TelegramBot",
		"LinkedInBot",
		"Pinterestbot",
		"Pinterest/",
		"redditbot",
		"Mastodon",
		"Bluesky",
		"Signal",
		"SkypeUriPreview",
		"MicrosoftPreview",
		"Iframely",
		"Embedly",
		"vkShare",
		"Viber",
		"Snapchat",
	]) {
		assert.equal(cardClient(token.toLowerCase()), "preview", token)
		assert.equal(cardClient(token.toUpperCase()), "preview", token)
	}
	assert.equal(
		cardClient(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
		),
		"preview",
	)
})

test("crawlers, browsers, and missing agents", () => {
	for (const agent of [
		"Googlebot",
		"Googlebot-Image/1.0",
		"bingbot",
		"meta-externalagent",
		"GPTBot",
	])
		assert.equal(cardClient(agent), "crawler", agent)
	for (const agent of [
		null,
		undefined,
		"",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	])
		assert.equal(cardClient(agent), "other")
})
