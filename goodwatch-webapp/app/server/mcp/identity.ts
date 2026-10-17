// Public protocol identity. Keep server.json in sync (checked by identity.test.ts).
export const mcpServerInfo = {
	name: "goodwatch",
	title: "GoodWatch",
	description:
		"Find movies and TV shows, track watches, and get suggestions based on your taste.",
	version: "1.0.0",
	websiteUrl: "https://goodwatch.app/use-with-ai",
	icons: [
		{
			src: "https://goodwatch.app/mcp-icons/goodwatch-48.png",
			mimeType: "image/png",
			sizes: ["48x48"],
		},
		{
			src: "https://goodwatch.app/mcp-icons/goodwatch-128.png",
			mimeType: "image/png",
			sizes: ["128x128"],
		},
		{
			src: "https://goodwatch.app/mcp-icons/goodwatch-512.png",
			mimeType: "image/png",
			sizes: ["512x512"],
		},
	],
}
