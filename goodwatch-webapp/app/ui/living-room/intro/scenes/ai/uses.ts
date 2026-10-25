// The asks that rush past at the end of the chapter. Each is something GoodWatch's MCP server really does
// (app/server/mcp/tools.server.ts and write-tools.server.ts); the comment above each names the tool call.

export type Use = {
	ask: string
	/** Plain name of the tool call, as the pill shows it. */
	tool: string
}

export const USES: Use[] = [
	// get_title include=episodes
	{
		ask: "best episodes of breaking bad?",
		tool: "episode scores",
	},
	// set_show_status dropped
	{
		ask: "drop the bear, i'm done",
		tool: "show status",
	},
	// get_person
	{
		ask: "movies with florence pugh",
		tool: "filmography",
	},
	// create_list (exactly five titles)
	{
		ask: "make a top 5 of cozy winter movies",
		tool: "share list",
	},
	// get_similar_titles
	{
		ask: "more like severance",
		tool: "more like this",
	},
	// get_my_shows
	{
		ask: "what's new from my shows?",
		tool: "my shows",
	},
	// rate_title
	{
		ask: "rate the dark knight a 10",
		tool: "rate",
	},
	// set_want_to_see
	{
		ask: "add interstellar to my wishlist",
		tool: "Wishlist",
	},
	// log_watch whole season
	{
		ask: "watched all of chernobyl",
		tool: "log a watch",
	},
	// set_my_services
	{
		ask: "i have netflix and mubi now",
		tool: "my services",
	},
	// get_show_progress
	{
		ask: "where am i in shōgun?",
		tool: "show progress",
	},
	// undo_watch
	{
		ask: "oops, undo that last episode",
		tool: "remove a watch",
	},
	// discover_titles
	{
		ask: "new sci-fi on my services",
		tool: "discover",
	},
	// get_taste
	{
		ask: "what's my taste like?",
		tool: "your taste",
	},
	// set_not_interested
	{
		ask: "not interested in the walking dead",
		tool: "not interested",
	},
	// get_title (cast and directors)
	{
		ask: "who directed memento?",
		tool: "title details",
	},
	// get_title include=seasons
	{
		ask: "season scores for game of thrones?",
		tool: "season scores",
	},
	// update_list_titles
	{
		ask: "swap memento into my top 5",
		tool: "edit share list",
	},
	// get_library
	{
		ask: "my highest rated movies",
		tool: "my library",
	},
	// set_settings
	{
		ask: "show titles in german",
		tool: "settings",
	},
]
