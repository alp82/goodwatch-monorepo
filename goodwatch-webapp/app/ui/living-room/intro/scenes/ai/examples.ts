// The chat's example data for The Penguin, as GoodWatch's MCP tools answered it on 2026-10-25: an example member's
// taste match, the provider scores (get_title include=scores) and the availability in Germany (get_title, DE).

/** A title as the chat's cards show it. */
export type ChatCard = {
	title: string
	year: number
	poster: string
	backdrop?: string
	/** GoodWatch score, 0-100. */
	score: number
	/** The member's taste match, percent. */
	match?: number
}

/** Provider scores: IMDb, Rotten Tomatoes, Metacritic. */
export type Sources = { imdb: number; rt: number; mc: number }

export const PENGUIN = {
	/** The example member's taste match, percent. */
	match: 69,
	sources: { imdb: 8.6, rt: 95, mc: 72 } satisfies Sources,
	stream: { service: "HBO Max", logo: "/skypuy7SXuugIQeYg0IglmzoKaS.png" },
}
