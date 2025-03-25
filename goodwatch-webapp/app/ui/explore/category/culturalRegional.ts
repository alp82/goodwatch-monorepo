import type { PageData } from "~/ui/explore/config"

export const culturalRegional: Record<string, PageData> = {
	anime: {
		type: "all",
		label: "Anime",
		path: "anime",
		subtitle: "Eastern Animation",
		description:
			"Power-up sequences, emotional depth beneath stylized action, and stories that blur the line between fantasy and philosophy. Where big eyes meet bigger ideas.",
		backdrop_path: "8x9iKH8kWA0zdkgNdpAew7OstYe.jpg",
		discoverParams: {
			similarDNA:
				"36378726_Sub-Genres|Anime,36375004_Target+Audience|Anime+Fans,36378727_Sub-Genres|Anime-Influenced,36401449_Cinematic+Style|Anime+Aesthectics,36399452_Cinematic+Style|Anime+Style",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes anime storytelling unique?",
				a: "The freedom to blend genres and break reality's rules while exploring deeply human themes. Visual spectacle meets emotional complexity.",
			},
		],
	},
	bollywood: {
		type: "all",
		label: "Bollywood",
		path: "bollywood",
		subtitle: "Musical Masala",
		description:
			"Colorful dance numbers, family traditions colliding with modern love, and emotions as big as the musical numbers. Where every feeling deserves its own soundtrack.",
		backdrop_path: "AcLsfw3TVZGFFT8yRA5StPKk65y.jpg",
		discoverParams: {
			similarDNA:
				"36393008_Sub-Genres|Bollywood,36459074_Sub-Genres|Bollywood+Film,36406177_Target+Audience|Bollywood+Fans,36393014_Score+and+Sound|Bollywood+Music,36415686_Place|Rural+India,36388020_Place|Indian+Subcontinent,36407265_Costume+and+Set|Traditional+Indian+Attire",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines Bollywood storytelling?",
				a: "The seamless blend of drama, music, and cultural values. These are epic emotional journeys where breaking into song feels natural.",
			},
		],
	},
}
