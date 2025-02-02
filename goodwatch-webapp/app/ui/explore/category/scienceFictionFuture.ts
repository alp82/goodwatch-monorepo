import type { PageData } from "~/ui/explore/config"

export const scienceFictionFuture: Record<string, PageData> = {
	space: {
		type: "all",
		label: "Space",
		path: "space",
		subtitle: "Final Frontier Adventures",
		description:
			"Black hole mysteries, hostile aliens, and spaceships held together by duct tape. Where every 'small step' could be your last.",
		backdrop_path: "oxv9a3dJvs4aAi5ctB4pQSdTji3.jpg",
		discoverParams: {
			similarDNA:
				"292710_Place|Space+Station,316248_Sub-Genres|Space+Opera,316237_Plot|Space+Exploration,313891_Place|Space,309406_Place|Outer+Space,296712_Place|Space+Ship",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines a great space story?",
				a: "The balance between cosmic wonder and human-scale drama. Whether battling aliens or fixing oxygen systems, the stakes are always astronomical.",
			},
		],
	},
	alien: {
		type: "all",
		label: "Alien",
		path: "alien",
		subtitle: "Close Encounters of Every Kind",
		description:
			"First contact protocols gone wrong, hybrid experiments, and invasions where the real threat might be human paranoia.",
		backdrop_path: "zFKPAMN9kWr1hJF4owR83DrwjK6.jpg",
		discoverParams: {
			similarDNA:
				"312027_Sub-Genres|Alien+Invasion,315344_Plot|Alien+Encounters,292768_Place|Alien+Planets,312028_Character+Types|Alien,114587_Sub-Genres|Alien+Film",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What differentiates alien stories?",
				a: "They explore humanity through an outsider's lens. Whether invaders or refugees, aliens make us question what 'humanity' really means.",
			},
		],
	},
	"time-travel": {
		type: "all",
		label: "Time Travel",
		path: "time-travel",
		subtitle: "Chronological Chaos",
		description:
			"Butterfly effects, paradoxes, and desperate races to fix timelines. Where changing one minute could unravel centuries.",
		backdrop_path: "xqUr7Mr9kFStiay0HS4zq2h9xPQ.jpg",
		discoverParams: {
			similarDNA:
				"293197_Sub-Genres|Time+Travel,309362_Key+Props|Time+Machine,309364_Character+Types|Time+Traveler,306759_Humor|Time+Travel+Humor",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes time travel stories work?",
				a: "The perfect balance between scientific plausibility and emotional stakes. The best ones make you ponder fate versus free will.",
			},
		],
	},
	disaster: {
		type: "all",
		label: "Disaster",
		path: "disaster",
		subtitle: "Unplanned Survival",
		description:
			"Rumbling earthquakes, viral pandemics, and asteroids on collision courses. When Mother Nature decides enough is enough.",
		backdrop_path: "b3u3ayecSfwak4hyRbvRiI3pxTM.jpg",
		discoverParams: {
			similarDNA:
				"232174_Plot|Natural+Disaster+Survival,260903_Plot|Nuclear+Disaster,274843_Sub-Genres|Natural+Disaster+Film,246445_Plot|Post-Disaster+Recovery,193203_Plot|Disaster+Preparedness",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes disaster stories compelling?",
				a: "They test human resilience against impossible odds. The spectacle of destruction is just the backdrop for personal redemption arcs.",
			},
		],
	},
	superhero: {
		type: "all",
		label: "Superhero",
		path: "superhero",
		subtitle: "Capes and Consequences",
		description:
			"Altered DNA, city-leveling battles, and the eternal question: mask or no mask? Great power meets greater responsibility.",
		backdrop_path: "dLWoJnYXhFeNouon4NmBLAr92rf.jpg",
		discoverParams: {
			similarDNA:
				"308743_Sub-Genres|Superhero,310315_Plot|Superhero+Origin+Story,309416_Target+Audience|Superhero+Fans,313683_Key+Props|Superhero+Suit,309413_Sub-Genres|Superhero+Comedy,10643284_Sub-Genres|Superhero+Drama",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What elevates superhero stories beyond spectacle?",
				a: "When they explore the human behind the hero. The best ones show that saving the world is easy compared to saving yourself.",
			},
		],
	},
	apocalyptic: {
		type: "all",
		label: "Apocalyptic",
		path: "apocalyptic",
		subtitle: "End Times Survival",
		description:
			"Empty cities, scavenger ethics, and communities rebuilding from ashes. When the end is just the beginning.",
		backdrop_path: "79sykEPGRMvRDy1hqkpeitejW0R.jpg",
		discoverParams: {
			similarDNA:
				"276184_Time|Post-Apocalyptic+Future,310959_Plot|Post-Apocalyptic+Survival,309122_Sub+Genres|Post-Apocalyptic,308715_Sub+Genres|Apocalyptic,229315_Mood|Apocalyptic",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What differentiates apocalyptic stories?",
				a: "They focus on building anew rather than preventing disaster. It's about human ingenuity when all the rules are gone.",
			},
		],
	},
	dystopian: {
		type: "all",
		label: "Dystopian",
		path: "dystopian",
		subtitle: "Dark Futures",
		description:
			"Oppressive regimes, environmental collapse, and societies where hope is the most dangerous contraband. Not recommended for optimists.",
		backdrop_path: "askFH4GSk2u9z3ZE5ypdKIMeqLJ.jpg",
		discoverParams: {
			similarDNA:
				"292635_Sub-Genres|Dystopian,308605_Sub-Genres|Dystopian+Satire,312433_Place|Dystopian+Metropolis,316608_Plot|Dystopian+Society,308571_Plot|Dystopian+Future",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines dystopian stories?",
				a: "They exaggerate current societal fears into future nightmares, serving as both warning and reflection of our present.",
			},
		],
	},
	"end-of-world": {
		type: "all",
		label: "End of World",
		path: "end-of-world",
		subtitle: "Final Countdown",
		description:
			"Ticking doomsday clocks, last-ditch missions, and humanity facing extinction with a quip and a prayer. Save the world, or die trying.",
		backdrop_path: "ezk6gCvmIntgBnHPyPgnzWplXIP.jpg",
		discoverParams: {
			similarDNA:
				"288148_Themes|End+Times,10235_Time|End+Times,308710_Themes|End+Of+The+World,268598_Plot|Human+Extinction",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What separates end-of-world from disaster stories?",
				a: "The focus on prevention rather than survival. These are race-against-time tales where failure means total annihilation.",
			},
		],
	},
}
