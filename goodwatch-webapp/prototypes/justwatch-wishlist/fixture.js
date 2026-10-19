// Synthetic JustWatch account for #708. Invented native IDs; catalog IDs are public TMDB/IMDb IDs.
// `truth` is what a correct round trip must produce. It is never visible to the exporter.

const at = (day) => `2026-0${1 + (day % 9)}-${String(1 + (day % 27)).padStart(2, "0")}T10:00:00.000Z`

const movie = (id, title, year, ids, extra = {}) => ({
	id: `tm${id}`,
	objectId: id,
	objectType: "MOVIE",
	content: { title, originalReleaseYear: year, fullPath: `/us/movie/${id}`, externalIds: ids },
	...extra,
})
const show = (id, title, year, ids, extra = {}) => ({
	id: `ts${id}`,
	objectId: id,
	objectType: "SHOW",
	content: { title, originalReleaseYear: year, fullPath: `/us/tv-show/${id}`, externalIds: ids },
	...extra,
})
const wish = (day) => ({ watchlistEntryV2: { createdAt: at(day) } })

/** Watchlist in LAST_ADDED order. Each entry: [node, truth]. */
export const watchlist = [
	[movie(1001, "Toy Story", 1995, { tmdbId: "862", imdbId: "tt0114709" }, wish(1)), { type: "movie", tmdb: 862, case: "clean movie" }],
	[show(2001, "The Office", 2005, { tmdbId: "2316", imdbId: "tt0386676" }, wish(2)), { type: "show", tmdb: 2316, case: "repeated title A (US)" }],
	[show(2002, "The Office", 2001, { tmdbId: "2996", imdbId: "tt0290978" }, wish(3)), { type: "show", tmdb: 2996, case: "repeated title B (UK)" }],
	[movie(1002, "Dune", 2021, { tmdbId: "438631", imdbId: "tt1160419" }, wish(4)), { type: "movie", tmdb: 438631, case: "repeated title, remake" }],
	[movie(1003, "Dune", 1984, { tmdbId: "841", imdbId: "tt0087182" }, wish(5)), { type: "movie", tmdb: 841, case: "repeated title, original" }],
	[movie(1004, "Fargo", 1996, { tmdbId: "275", imdbId: "tt0116282" }, wish(6)), { type: "movie", tmdb: 275, case: "same title as a show" }],
	[show(2003, "Fargo", 2014, { tmdbId: "60622", imdbId: "tt2802850" }, wish(7)), { type: "show", tmdb: 60622, case: "same title as a movie" }],
	[movie(1005, "Heat", 1995, { tmdbId: "949", imdbId: "tt0113277" }, { ...wish(8), seenlistEntry: { createdAt: at(30) } }), { type: "movie", tmdb: 949, case: "seen on JustWatch and wished; Seen in GoodWatch", outcome: "conflict" }],
	[show(2004, "Severance", 2022, { tmdbId: "95396", imdbId: "tt11280740" }, { ...wish(9), tvShowTrackingEntry: { createdAt: at(31) }, seenState: { progress: 0.4 } }), { type: "show", tmdb: 95396, case: "wished show in progress; Watching in GoodWatch", outcome: "unchanged" }],
	[movie(1006, "Obscure Festival Short", 2019, null, wish(10)), { type: "movie", tmdb: null, case: "no external IDs, not in catalog", outcome: "unmatched" }],
	[movie(1007, "Amélie", 2001, { tmdbId: null, imdbId: "tt0211915" }, wish(11)), { type: "movie", tmdb: 194, case: "IMDb only" }],
	[movie(1008, "The Matrix", 1999, { tmdbId: "abc", imdbId: "tt0133093" }, wish(12)), { type: "movie", tmdb: 603, case: "malformed TMDB ID, good IMDb ID" }],
	[movie(1009, "Inception", 2010, { tmdbId: "603", imdbId: "tt1375666" }, wish(13)), { type: "movie", tmdb: 27205, case: "provider TMDB ID contradicts its IMDb ID (held for a choice by #714)", outcome: "unmatched", providerIdWrong: true }],
	[movie(680, "Die Verurteilten", 1994, null, wish(14)), { type: "movie", tmdb: 278, case: "localized title, no IDs, objectId equals another title's TMDB ID", outcome: "unmatched" }],
	[{ id: "tse2005", objectId: 2005, objectType: "SHOW_SEASON", content: { title: "Stranger Things – Season 2", originalReleaseYear: 2017, fullPath: "/us/tv-show/stranger-things/season-2", externalIds: { tmdbId: "66732", imdbId: null } }, ...wish(15) }, { type: "unknown", tmdb: null, case: "season object type", outcome: "unmatched" }],
	[movie(1011, "Arrival", 2016, { tmdbId: "329865", imdbId: "tt2543164" }, { watchlistEntryV2: { createdAt: null } }), { type: "movie", tmdb: 329865, case: "no added date" }],
	[movie(1013, "Parasite", 2019, { tmdbId: "496243", imdbId: "tt6751668" }, wish(17)), { type: "movie", tmdb: 496243, case: "already a GoodWatch wish", outcome: "unchanged" }],
	[{ id: "tm1014", objectId: 1014, objectType: "MOVIE", content: null, ...wish(18) }, { type: "movie", tmdb: null, case: "content missing", outcome: "invalid" }],
	[movie(1015, "Bad\u0007Title", 2020, { tmdbId: "550", imdbId: "tt0137523" }, wish(19)), { type: "movie", tmdb: null, case: "control character in title", outcome: "invalid" }],
	[show(2006, "Game of Thrones", null, { tmdbId: "1399", imdbId: "tt0944947" }, wish(20)), { type: "show", tmdb: 1399, case: "show with no year" }],
	[movie(1016, "The Dark Knight", 2008, { tmdbId: 155, imdbId: "tt0468569" }, wish(21)), { type: "movie", tmdb: 155, case: "TMDB ID as number" }],
	[movie(1017, "Upcoming Film", 2027, { tmdbId: "99999999", imdbId: null }, wish(22)), { type: "movie", tmdb: null, case: "TMDB ID not in catalog", outcome: "unmatched" }],
	[show(2007, "Sherlock", 2010, { tmdbId: "19885", imdbId: "tt1475582" }, wish(23)), { type: "show", tmdb: 19885, case: "TMDB ID also used by a movie" }],
	[movie(1018, "Spirited Away", 2001, { tmdbId: "129", imdbId: "tt0245429" }, { ...wish(24), seenlistEntry: { createdAt: at(32) } }), { type: "movie", tmdb: 129, case: "seen on JustWatch and wished; not Seen in GoodWatch (source Seen, v1.1)", outcome: "conflict" }],
]
// Plain filler so the list spans three 20-item pages.
for (let index = 0; index < 23; index++) {
	const id = 5000 + index
	const tmdb = 900000 + index
	const node =
		index % 3 === 2
			? show(id, `Filler Show ${index}`, 2000 + index, { tmdbId: String(tmdb), imdbId: `tt${String(8000000 + index)}` }, wish(25 + index))
			: movie(id, `Filler Movie ${index}`, 2000 + index, { tmdbId: String(tmdb), imdbId: `tt${String(8000000 + index)}` }, wish(25 + index))
	watchlist.push([node, { type: index % 3 === 2 ? "show" : "movie", tmdb, case: "filler" }])
}

/** Titles that must never become wishes. */
export const negativeControls = [
	movie(3001, "Seen Only Movie", 2011, { tmdbId: "13", imdbId: "tt0109830" }, { seenlistEntry: { createdAt: at(40) } }),
	show(3002, "Tracked Only Show", 2018, { tmdbId: "1396", imdbId: "tt0903747" }, { tvShowTrackingEntry: { createdAt: at(41) }, seenState: { progress: 0 } }),
	show(3003, "Finished Show", 2013, { tmdbId: "1408", imdbId: "tt0412142" }, { tvShowTrackingEntry: { createdAt: at(42) }, seenState: { progress: 1 } }),
	movie(3004, "Liked Only Movie", 2009, { tmdbId: "19995", imdbId: "tt0499549" }, { likelistEntry: { createdAt: at(43) } }),
]

/** A title added to the Watchlist while a capture is running (list-shift scenario). */
export const lateAddition = [
	movie(1099, "Late Addition", 2024, { tmdbId: "693134", imdbId: "tt15239678" }, wish(60)),
	{ type: "movie", tmdb: 693134, case: "added during capture" },
]

/** GoodWatch catalog rows, split by table. */
export const catalog = {
	movie: [
		[862, "tt0114709", "Toy Story", 1995],
		[438631, "tt1160419", "Dune", 2021],
		[841, "tt0087182", "Dune", 1984],
		[275, "tt0116282", "Fargo", 1996],
		[949, "tt0113277", "Heat", 1995],
		[194, "tt0211915", "Amélie", 2001],
		[603, "tt0133093", "The Matrix", 1999],
		[27205, "tt1375666", "Inception", 2010],
		[278, "tt0111161", "The Shawshank Redemption", 1994],
		[680, "tt0110912", "Pulp Fiction", 1994],
		[329865, "tt2543164", "Arrival", 2016],
		[496243, "tt6751668", "Parasite", 2019],
		[550, "tt0137523", "Fight Club", 1999],
		[155, "tt0468569", "The Dark Knight", 2008],
		[19885, "tt0000001", "A Movie Sharing Sherlock's Number", 1950],
		[129, "tt0245429", "Spirited Away", 2001],
		[693134, "tt15239678", "Late Addition", 2024],
		[13, "tt0109830", "Seen Only Movie", 2011],
		[19995, "tt0499549", "Liked Only Movie", 2009],
	],
	show: [
		[2316, "tt0386676", "The Office", 2005],
		[2996, "tt0290978", "The Office", 2001],
		[60622, "tt2802850", "Fargo", 2014],
		[95396, "tt11280740", "Severance", 2022],
		[1399, "tt0944947", "Game of Thrones", 2011],
		[19885, "tt1475582", "Sherlock", 2010],
		[66732, "tt4574334", "Stranger Things", 2016],
		[1396, "tt0903747", "Tracked Only Show", 2018],
		[1408, "tt0412142", "Finished Show", 2013],
	],
}
for (const [node, truth] of watchlist)
	if (truth.case === "filler")
		catalog[truth.type].push([truth.tmdb, node.content.externalIds.imdbId, node.content.title, node.content.originalReleaseYear])

/** The member's GoodWatch library before the import. */
export const library = {
	seenMovies: [949],
	watchingShows: [95396],
	wishes: [{ mediaType: "movie", tmdbId: 496243 }],
}
