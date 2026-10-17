// What members type to their AI app, written the way people really type: lowercase, casual and short ("s2e4", not
// "season 2, episode 4"; "score dune 2 with 9", not "Rate Dune: Part Two 9 out of 10"). The owner's rule from
// October 17, 2026. The connector help page (/connect) and /use-with-ai show these; example-prompts.test.ts keeps
// them in that voice.

// Things to ask, on /connect.
export const CONNECT_EXAMPLES = [
	"what should i watch next",
	"what on my wishlist would i love most",
	"something like arrival but lighter",
	"anything good on netflix tonight",
	"just watched severance s2e4",
	"score dune 2 with 9",
] as const

// The search-by-description example in /connect's note on limits.
export const DESCRIPTION_SEARCH_EXAMPLE = "slow sci-fi like arrival"

// The questions the chat demo on /use-with-ai switches between.
export const CHAT_DEMO_QUESTIONS = {
	tonight: "what should i watch tonight",
	wishlist: "what on my wishlist would i love most",
	log: "just watched dark s3e7",
} as const

// Things to ask on /use-with-ai, each with what GoodWatch does with it.
export const USE_WITH_AI_ASKS = [
	{
		key: "tonight",
		ask: "anything good on netflix tonight",
		does: "Picks that stream on your services, for your taste",
	},
	{
		key: "like",
		ask: "something like arrival but lighter",
		does: "Titles ranked by how well they fit you",
	},
	{
		key: "add",
		ask: "add severance to my list",
		does: "Puts it on your Wishlist",
	},
	{
		key: "log",
		ask: "watched severance s2e4",
		does: "Logs the episode and moves your progress",
	},
	{
		key: "score",
		ask: "score dune 2 with 9",
		does: "Saves your score and sharpens your taste",
	},
	{
		key: "person",
		ask: "what else did the past lives director make",
		does: "Their films, with your match for each",
	},
] as const

export const ALL_EXAMPLE_PROMPTS: readonly string[] = [
	...CONNECT_EXAMPLES,
	DESCRIPTION_SEARCH_EXAMPLE,
	...Object.values(CHAT_DEMO_QUESTIONS),
	...USE_WITH_AI_ASKS.map(({ ask }) => ask),
]
