import type { PageData } from "~/ui/explore/config"

export const streaming: Record<string, PageData> = {
	netflix: {
		type: "all",
		label: "Netflix",
		path: "netflix",
		subtitle: "Watch on Netflix right now",
		description: "",
		backdrop_path: "/images/backdrops/backdrop-streaming-netflix.webp",
		discoverParams: {
			streamingPreset: "custom",
			withStreamingProviders: "8",
		},
		faq: [
			{
				q: "",
				a: "",
			},
		],
	},
	"amazon-prime": {
		type: "all",
		label: "Amazon Prime",
		path: "amazon-prime",
		subtitle: "Watch on Prime right now",
		description: "",
		backdrop_path: "/images/backdrops/backdrop-streaming-amazon-prime.webp",
		discoverParams: {
			streamingPreset: "custom",
			withStreamingProviders: "9",
		},
		faq: [
			{
				q: "",
				a: "",
			},
		],
	},
	"disney-plus": {
		type: "all",
		label: "Disney Plus",
		path: "disney-plus",
		subtitle: "Watch on Disney Plus right now",
		description: "",
		backdrop_path: "/images/backdrops/backdrop-streaming-disney-plus.webp",
		discoverParams: {
			streamingPreset: "custom",
			withStreamingProviders: "337",
		},
		faq: [
			{
				q: "",
				a: "",
			},
		],
	},
	// hulu: {
	// 	type: "all",
	// 	label: "Hulu",
	// 	path: "hulu",
	// 	subtitle: "Watch on Hulu right now",
	// 	description: "",
	// 	discoverParams: {
	// 		streamingPreset: "custom",
	// 		withStreamingProviders: "15",
	// 	},
	// 	faq: [
	// 		{
	// 			q: "",
	// 			a: "",
	// 		},
	// 	],
	// },
}
