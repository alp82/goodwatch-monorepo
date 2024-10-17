/** @type {import('tailwindcss').Config} */
const colors = require("tailwindcss/colors")
const defaultTheme = require("tailwindcss/defaultTheme")

module.exports = {
	content: ["./app/**/*.{js,jsx,ts,tsx}"],
	future: {
		hoverOnlyWhenSupported: true,
	},
	plugins: [
		require("@tailwindcss/aspect-ratio"),
		require("@tailwindcss/forms"),
		require("@tailwindcss/typography"),
		require("tailwindcss/plugin")(({ addVariant }) => {
			addVariant("search-cancel", "&::-webkit-search-cancel-button")
		}),
	],
	safelist: [
		{ pattern: /bg-vibe-[0-9]+/ },
		{ pattern: /from-\w+-700\/[0-9]+/ },
		{ pattern: /via-\w+-900\/[0-9]+/ },
		{ pattern: /to-\w+-800\/[0-9]+/ },
	],
	theme: {
		screens: {
			xs: "475px",
			...defaultTheme.screens,
		},
		extend: {
			colors: {
				gray: {
					950: "#060606",
				},
				vibe: {
					0: "#D61F1F",
					10: "#D61F1F",
					20: "#D61F1F",
					30: "#D61F1F",
					40: "#d0481c",
					50: "#ba7215",
					60: "#a9930a",
					70: "#86a61a",
					80: "#3b9011",
					90: "#0d8033",
					100: "#0d8033",
				},
				imdb: "#f6c800",
				metacritic: "#010101",
				rotten: "#f83309",
			},
			screens: {
				"sm-h": { raw: "(max-height: 1000px)" },
				"lg-h": { raw: "(min-height: 1001px)" },
			},
		},
	},
}
