type Choice = { name: string; value: string }
/** Registration is static and can run offline under plain Node. */
export function defineCommands() {
	const option = (name: string, description: string, choices: Choice[]) => ({
		name,
		description,
		type: 3,
		choices: choices.slice(0, 25).map((choice) => ({
			name: choice.name.slice(0, 100),
			value: choice.value.slice(0, 100),
		})),
	})
	const moodChoices = [
		{ name: "Funny", value: "funny" },
		{ name: "Feel-good", value: "feelgood" },
		{ name: "Romance", value: "romance" },
		{ name: "Action", value: "action" },
		{ name: "Scary", value: "scary" },
		{ name: "Crime & mystery", value: "crime" },
		{ name: "Mind-bending", value: "mind" },
		{ name: "Heavy", value: "heavy" },
		{ name: "Other worlds", value: "worlds" },
		{ name: "History", value: "history" },
		{ name: "Coming of age", value: "growing" },
	]
	const title = {
		name: "title",
		description: "Movie or TV show title",
		type: 3,
		required: true,
		autocomplete: true,
	}
	const discovery = [
		...["rate", "seen", "want"].map((name) => ({
			name,
			description: {
				rate: "Rate a title",
				seen: "Log a watch today",
				want: "Want to See: add a title to your Wishlist",
			}[name]!,
			options: [
				title,
				...(name === "rate"
					? [
							{
								name: "score",
								description: "Your score from 1 to 10",
								type: 4,
								required: true,
								min_value: 1,
								max_value: 10,
							},
						]
					: []),
			],
		})),
		{
			name: "setup",
			description: "Set this server's country and streaming services",
			default_member_permissions: "32",
			options: [
				{
					name: "country",
					description: "Server country",
					type: 3,
					autocomplete: true,
				},
				{
					name: "service",
					description: "Add a streaming service",
					type: 3,
					autocomplete: true,
				},
			],
		},
		{
			name: "search",
			description: "Search movies and TV shows on GoodWatch",
			options: [
				{
					...title,
					name: "query",
					description: "A title, a person, or a mood like dark vibes",
				},
			],
		},
		{
			name: "similar",
			description: "Find titles similar to a movie or TV show",
			options: [title],
		},
		{
			name: "person",
			description: "Find a person and their known-for titles",
			options: [
				{
					name: "name",
					description: "Person's name",
					type: 3,
					required: true,
					autocomplete: true,
				},
			],
		},
		{
			name: "discover",
			description: "Discover movies and TV shows",
			options: [
				option("type", "Movie, show, or any", [
					{ name: "Movies", value: "movie" },
					{ name: "Shows", value: "show" },
					{ name: "Movies and shows", value: "any" },
				]),
				option("mood", "Kind of evening", moodChoices),
				{ name: "genre", description: "Genre", type: 3, autocomplete: true },
				{
					name: "service",
					description: "Streaming service in your country",
					type: 3,
					autocomplete: true,
				},
				option("sort", "Result order", [
					{ name: "For you", value: "for_you" },
					{ name: "Popular", value: "popularity" },
					{ name: "Newest", value: "newest" },
					{ name: "Best score", value: "score" },
					{ name: "Best match", value: "match" },
				]),
			],
		},
		{
			name: "together",
			description: "Choose what to watch together with private votes",
			options: [
				option("type", "Movie, show, or any", [
					{ name: "Movies", value: "movie" },
					{ name: "Shows", value: "show" },
					{ name: "Movies and shows", value: "any" },
				]),
				option("mood", "Kind of evening", moodChoices),
			],
		},
		{
			name: "hot",
			description: "Titles hot on socials right now",
			options: [],
		},
		{ name: "link", description: "Link your GoodWatch account", options: [] },
		{
			name: "unlink",
			description: "Unlink your GoodWatch account",
			options: [],
		},
	]
	const discover = discovery.find((command) => command.name === "discover")!
	return [
		...discovery,
		{
			name: "watch",
			description: "Get a pick to watch",
			options: discover.options.slice(0, 2),
		},
		{ name: "next", description: "Next episodes from Watch next", options: [] },
	].map((command) => ({
		...command,
		type: 1,
		integration_types: ["setup", "together"].includes(command.name)
			? [0]
			: [0, 1],
		contexts: ["setup", "together"].includes(command.name) ? [0] : [0, 1, 2],
	}))
}
export const commands = defineCommands()
