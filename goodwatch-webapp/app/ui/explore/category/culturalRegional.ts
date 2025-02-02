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
				"308633_Sub-Genres|Anime,292627_Target+Audience|Anime+Fans,310183_Sub-Genres|Anime-Influenced,253089_Sub-Genres|Idol+Anime,208666_Sub-Genres|School+Anime",
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
				"294710_Sub-Genres|Bollywood,254037_Target+Audience|Bollywood+Fans,254036_Score+and+Sound|Bollywood+Soundtrack,10220_Costume+and+Set|Bollywood+Costumes,287269_Place|Rural+India,219574_Place|Indian+Subcontinent",
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
