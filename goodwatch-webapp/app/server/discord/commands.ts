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
	const choices = (values: string[]) =>
		values.map((value) => ({ name: value, value }))
	const title = {
		name: "title",
		description: "Movie or TV show title",
		type: 3,
		required: true,
		autocomplete: true,
	}
	return [
		{
			name: "search",
			description: "Find a movie or TV show on GoodWatch",
			options: [title],
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
				option(
					"type",
					"Movie, show, or any",
					choices(["movie", "show", "any"]),
				),
				option("mood", "Kind of evening", [
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
				]),
				{ name: "genre", description: "Genre", type: 3, autocomplete: true },
				{
					name: "service",
					description: "Streaming service in your country",
					type: 3,
					autocomplete: true,
				},
				option(
					"sort",
					"Result order",
					choices(["for_you", "popularity", "newest", "score", "match"]),
				),
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
	].map((command) => ({
		...command,
		type: 1,
		integration_types: [0, 1],
		contexts: [0, 1, 2],
	}))
}
export const commands = defineCommands()
