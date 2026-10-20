// The GoodWatch connector: the address members paste into Claude or ChatGPT, and what a connected app can do. Shared
// by /use-with-ai, /support, the privacy policy, and the consent page and Connected apps tab (#570), so the lists a
// member agrees to are the lists the privacy policy describes.

export const CONNECTOR_URL = "https://goodwatch.app/mcp"
// The name members give the connector in their app. Claude Code uses it in its commands.
export const CONNECTOR_NAME = "GoodWatch"
export const CLAUDE_CODE_NAME = "goodwatch"

// How to add GoodWatch to each app, with a chat demo. #<app> opens one app's steps (/use-with-ai#cursor).
export const USE_WITH_AI_PATH = "/use-with-ai"
// Built in #570 (Settings, Connected apps). Linked from /use-with-ai, /support and the privacy policy.
export const CONNECTED_APPS_PATH = "/settings/connected-apps"
export const PRIVACY_CONNECTED_APPS_PATH = "/privacy#connected-apps"

// Shared capability summary for the current 25-tool integration and its consent page.
export const APP_CAN_SEE = [
	"Your ratings, Wishlist and Not interested titles",
	"What you've watched and where you are in each show",
	"Your taste profile and recommendations",
	"Your country, title language and streaming services",
	"Your share lists, including unlisted lists",
] as const

export const APP_CAN_CHANGE = [
	"Log what you watched, and remove a watch",
	"Rate titles and mark them Not interested",
	"Add titles to your Wishlist and remove them",
	"Set a show to Watching, On hold or Dropped",
	"Change your country, title language and streaming services",
	"Create public or unlisted share lists and change their titles and order",
] as const

export const APP_CAN_NEVER = [
	"See your email address or password",
	"Change your password or delete your account",
	"Connect other apps",
] as const

// Ranked search by description, per member per UTC day (#569).
export const RANKED_SEARCHES_PER_DAY = 20
