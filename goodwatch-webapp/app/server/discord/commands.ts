export const commands = [
	{
		name: "search",
		description: "Find a movie or TV show on GoodWatch",
		type: 1,
		integration_types: [0, 1],
		contexts: [0, 1, 2],
		options: [
			{
				name: "title",
				description: "Movie or TV show title",
				type: 3,
				required: true,
				autocomplete: true,
			},
		],
	},
]
