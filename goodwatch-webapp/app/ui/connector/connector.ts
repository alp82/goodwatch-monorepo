// The GoodWatch connector: the address members paste into Claude or ChatGPT, and what a connected app can do. Shared
// by the help page (/connect), the privacy policy, and the consent page and Connected apps tab (#570), so the lists a
// member agrees to are the lists the help page and the privacy policy describe.

export const CONNECTOR_URL = "https://goodwatch.app/mcp"
// The name members give the connector in their app. Claude Code uses it in its commands.
export const CONNECTOR_NAME = "GoodWatch"
export const CLAUDE_CODE_NAME = "goodwatch"

export const CONNECTOR_HELP_PATH = "/connect"
// The friendly, visual page: what GoodWatch looks like in a chat and drawn setup steps. Links to the help page.
export const USE_WITH_AI_PATH = "/use-with-ai"
// Built in #570 (Settings, Connected apps). Linked from the help page and the privacy policy.
export const CONNECTED_APPS_PATH = "/settings/connected-apps"
export const PRIVACY_CONNECTED_APPS_PATH = "/privacy#connected-apps"

// The sections of the help page, for links straight to one app.
export const CONNECTOR_HELP_SECTIONS = {
	claude: `${CONNECTOR_HELP_PATH}#claude`,
	claudeCode: `${CONNECTOR_HELP_PATH}#claude-code`,
	chatgpt: `${CONNECTOR_HELP_PATH}#chatgpt`,
	disconnect: `${CONNECTOR_HELP_PATH}#disconnect`,
} as const

// From the tool set decided in #535 (14 tools). The consent page lists the same.
export const APP_CAN_SEE = [
	"Your ratings, Wishlist and Not interested titles",
	"What you've watched and where you are in each show",
	"Your taste profile and recommendations",
	"Your country and streaming services",
] as const

export const APP_CAN_CHANGE = [
	"Log what you watched, and remove a watch",
	"Rate titles and mark them Not interested",
	"Add titles to your Wishlist and remove them",
	"Set a show to Watching, On hold or Dropped",
	"Change your country and streaming services",
] as const

export const APP_CAN_NEVER = [
	"See your email address or password",
	"Change your password or delete your account",
	"Connect other apps",
] as const

// Ranked search by description, per member per UTC day (#569).
export const RANKED_SEARCHES_PER_DAY = 20
