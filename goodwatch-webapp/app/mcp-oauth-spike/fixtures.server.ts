// Deliberately fictional catalog / progress; never import production server modules.
export const titles = [
	{
		id: "movie:spike-1",
		name: "The Last Lighthouse",
		kind: "movie",
		year: 2026,
		synopsis: "A lighthouse keeper solves a mystery on an island.",
		fixture: true,
	},
	{
		id: "show:spike-2",
		name: "Orbit Garden",
		kind: "show",
		year: 2026,
		synopsis: "Gardeners build a home on a distant station.",
		fixture: true,
	},
	{
		id: "show:spike-3",
		name: "Small Town Detectives",
		kind: "show",
		year: 2025,
		synopsis: "Two friends investigate their town's curious history.",
		fixture: true,
	},
]

export const shows = [
	{
		titleId: "show:spike-2",
		status: "Watching",
		nextEpisode: { season: 1, episode: 3 },
	},
	{
		titleId: "show:spike-3",
		status: "On hold",
		nextEpisode: { season: 2, episode: 1 },
	},
]
