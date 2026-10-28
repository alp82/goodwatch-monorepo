// What members type to their AI app, written the way people really type: lowercase, casual and short ("s2e4", not
// "season 2, episode 4"; "score dune 2 with 9", not "Rate Dune: Part Two 9 out of 10"). The owner's rule from
// October 17, 2026. /use-with-ai and /support show these; example-prompts.test.ts keeps them in that voice.

// The search-by-description example in /support's note on the daily limit.
export const DESCRIPTION_SEARCH_EXAMPLE = "slow sci-fi like arrival"

// The questions the chat demo on /use-with-ai switches between.
export const CHAT_DEMO_QUESTIONS = {
	tonight: "what should i watch tonight",
	wishlist: "what on my wishlist would i love most",
	log: "just watched dark s3e7",
} as const

// The first use case, also the prompt on the page's sharing image (og-image/copy.ts).
export const TONIGHT_ASK = "anything good on netflix tonight"

// Shared with the MCP prompt menu; these are the asks, separate from the tool workflow text.
export const MCP_PROMPT_EXAMPLES = {
	watch_tonight: "what should i watch tonight on my services",
	log_and_score: "just watched severance s2e4, score it with 9",
	more_like_this: "something like arrival",
	where_to_stream: "where can i stream past lives",
	catch_up_shows: "what's next in my shows",
	bulk_mark_seen: "mark these as seen with my scores",
	top_five_year: "make a top 5 list from 2025",
	compare_my_taste: "would i like arrival and why",
} as const

// The use cases on /use-with-ai: three groups of things to ask, each with what GoodWatch does with it. Every ask maps to
// one of the MCP tools (app/server/mcp), so the page promises only what the server does.
export const USE_WITH_AI_GROUPS = [
	{
		key: "find",
		title: "Find something to watch",
		hint: "Fits your taste and your services",
		asks: [
			{
				key: "tonight",
				ask: TONIGHT_ASK,
				does: "Picks that stream on your services, for your taste",
			},
			{
				key: "like",
				ask: "something like arrival but lighter",
				does: "Titles ranked by how well they fit you",
			},
			{
				key: "discover",
				ask: "feel-good movies from the 90s",
				does: "Browses like Discover, with the same filters",
			},
			{
				key: "stream",
				ask: MCP_PROMPT_EXAMPLES.where_to_stream,
				does: "Where it streams in your country",
			},
			{
				key: "person",
				ask: "what else did the past lives director make",
				does: "Their films, with your match for each",
			},
		],
	},
	{
		key: "library",
		title: "Keep your library up to date",
		hint: "Tell it what you watched",
		asks: [
			{
				key: "log",
				ask: "watched severance s2e4",
				does: "Logs the episode and moves your progress",
			},
			{
				key: "many",
				ask: "i've seen all the lord of the rings movies",
				does: "Logs up to 50 titles in one go",
			},
			{
				key: "score",
				ask: "score dune 2 with 9",
				does: "Saves your score and sharpens your taste",
			},
			{
				key: "add",
				ask: "add severance to my list",
				does: "Puts it on your Wishlist",
			},
			{
				key: "next",
				ask: MCP_PROMPT_EXAMPLES.catch_up_shows,
				does: "The next episode of each show you're watching",
			},
			{
				key: "hold",
				ask: "put the bear on hold",
				does: "Sets the show to On hold",
			},
		],
	},
	{
		key: "taste",
		title: "Taste, lists, and settings",
		hint: "Your profile, in plain words",
		asks: [
			{
				key: "taste",
				ask: "what does my taste say about me",
				does: "Reads your taste profile back to you",
			},
			{
				key: "list",
				ask: "make a list of my top 10 comedies",
				does: "Creates a share list you can post",
			},
			{
				key: "services",
				ask: "i cancelled disney+, update my services",
				does: "Changes your streaming services",
			},
			{
				key: "country",
				ask: "i'm in spain this month",
				does: "Switches your streaming country to Spain",
			},
		],
	},
] as const

export const ALL_EXAMPLE_PROMPTS: readonly string[] = [
	...Object.values(MCP_PROMPT_EXAMPLES),
	DESCRIPTION_SEARCH_EXAMPLE,
	...Object.values(CHAT_DEMO_QUESTIONS),
	...USE_WITH_AI_GROUPS.flatMap(({ asks }) => asks.map(({ ask }) => ask)),
]
