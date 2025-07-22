import { actionCombat } from "~/ui/explore/category/actionCombat"
import { crimeInvestigation } from "~/ui/explore/category/crimeInvestigation"
import { culturalRegional } from "~/ui/explore/category/culturalRegional"
import { genres } from "~/ui/explore/category/genres"
import { historicalPeriod } from "~/ui/explore/category/historicalPeriod"
import { moods } from "~/ui/explore/category/moods"
import { romanceRelationships } from "~/ui/explore/category/romanceRelationships"
import { scienceFictionFuture } from "~/ui/explore/category/scienceFictionFuture"
import { sportsCompetition } from "~/ui/explore/category/sportsCompetition"
import { streaming } from "~/ui/explore/category/streaming"
import { supernaturalMonsters } from "~/ui/explore/category/supernaturalMonsters"
import type { MainData } from "~/ui/explore/config"

export const mainHierarchy = {
	moods,
	streaming,
	// "action-combat": actionCombat,
	// "crime-investigation": crimeInvestigation,
	// "romance-relationships": romanceRelationships,
	// "sports-competition": sportsCompetition,
	// "supernatural-monsters": supernaturalMonsters,
	// "science-fiction-future": scienceFictionFuture,
	// "cultural-regional": culturalRegional,
	// "historical-period": historicalPeriod,
	genres,
}

export const mainNavigation: Record<keyof typeof mainHierarchy, MainData> = {
	moods: {
		path: "moods",
		label: "Moods",
		subtitle: "Emotional Journeys",
		description:
			"Find content that matches your state of mind, from spine-tingling tension to heart-warming comfort.",
		items: moods,
	},
	streaming: {
		path: "streaming",
		label: "Streaming",
		subtitle: "Platform Selection",
		description:
			"Navigate the world of streaming services and discover what each platform has to offer.",
		items: streaming,
	},
	// "action-combat": {
	// 	path: "action-combat",
	// 	label: "Action & Combat",
	// 	subtitle: "Physical Prowess and Combat Excellence",
	// 	description:
	// 		"From martial arts mastery to military precision, these stories celebrate the art of action and the discipline of combat.",
	// 	items: actionCombat,
	// },
	// "crime-investigation": {
	// 	path: "crime-investigation",
	// 	label: "Crime & Investigation",
	// 	subtitle: "Mystery and Justice",
	// 	description:
	// 		"Delve into the dark side of human nature through detective work, organized crime, and the pursuit of justice.",
	// 	items: crimeInvestigation,
	// },
	// "romance-relationships": {
	// 	path: "romance-relationships",
	// 	label: "Romance & Relationships",
	// 	subtitle: "Matters of the Heart",
	// 	description:
	// 		"Explore the complexities of love, connection, and personal growth through relationships both romantic and platonic.",
	// 	items: romanceRelationships,
	// },
	// "sports-competition": {
	// 	path: "sports-competition",
	// 	label: "Sports & Competition",
	// 	subtitle: "Athletic Achievement",
	// 	description:
	// 		"Experience the thrill of competition, team spirit, and personal triumph in the world of sports.",
	// 	items: sportsCompetition,
	// },
	// "supernatural-monsters": {
	// 	path: "supernatural-monsters",
	// 	label: "Supernatural & Monsters",
	// 	subtitle: "Beyond Natural Bounds",
	// 	description:
	// 		"Venture into the realm of the supernatural, where monsters lurk and horror awaits around every corner.",
	// 	items: supernaturalMonsters,
	// },
	// "science-fiction-future": {
	// 	path: "science-fiction-future",
	// 	label: "Science Fiction & Future",
	// 	subtitle: "Tomorrow's Tales",
	// 	description:
	// 		"Journey to the frontiers of imagination, where technology shapes destiny and the future unfolds in unexpected ways.",
	// 	items: scienceFictionFuture,
	// },
	// "cultural-regional": {
	// 	path: "cultural-regional",
	// 	label: "Cultural & Regional",
	// 	subtitle: "Global Storytelling",
	// 	description:
	// 		"Discover rich storytelling traditions from around the world, each with its unique cultural perspective.",
	// 	items: culturalRegional,
	// },
	// "historical-period": {
	// 	path: "historical-period",
	// 	label: "Historical & Period",
	// 	subtitle: "Times Past",
	// 	description:
	// 		"Step into different eras and explore stories shaped by the forces of history.",
	// 	items: historicalPeriod,
	// },
	genres: {
		path: "genres",
		label: "Genres",
		subtitle: "Classic Categories",
		description:
			"Explore traditional film and TV categories, from laugh-out-loud comedies to edge-of-your-seat thrillers.",
		items: genres,
	},
	// seasons: {
	// 	path: "seasons",
	// 	label: "Seasons",
	// 	subtitle: "",
	// 	description: "",
	// 	popular: {},
	// 	// popular: ["Halloween", "Christmas", "Fall", "Eve"],
	// },
	// languages: {
	// 	path: "languages",
	// 	label: "Languages",
	// 	subtitle: "",
	// 	description: "",
	// 	popular: {},
	// 	// popular: ["Korean", "English", "Hindi", "Japanese", "French", "Chinese"],
	// },
}
