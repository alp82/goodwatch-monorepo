import type { PageData } from "~/ui/explore/config"

export const actionCombat: Record<string, PageData> = {
	military: {
		type: "all",
		label: "Military",
		path: "military",
		subtitle: "Brothers in Arms",
		description:
			"Boot camp bonds, tactical gambles, and missions where coming home is the real victory. Salute the stories behind the salutes.",
		backdrop_path: "dcqI4l0vvGAyLsGGxobNsCVQdNK.jpg",
		discoverParams: {
			similarDNA:
				"36373578_Costume+and+Set|Military+Uniforms,36374408_Sub-Genres|Military+Drama,36373571_Place|Military+Base,36376817_Dialog|Military+Jargon,36381546_Plot|Military+Strategy",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines great military storytelling?",
				a: "The tension between duty and morality, showing both the glory and gut-wrenching costs of service.",
			},
		],
	},
	"martial-arts": {
		type: "all",
		label: "Martial Arts",
		path: "martial-arts",
		subtitle: "Fight Choreography",
		description:
			"Flying kicks, monastery wisdom, and tournaments where pride matters more than trophies. Pain is the price of mastery.",
		backdrop_path: "wdHIYawEp7lnf1XNzp6rWxLYgUG.jpg",
		discoverParams: {
			similarDNA:
				"36373553_Sub-Genres|Martial+Arts,36389740_Plot|Martial+Arts+Tournament,36374951_Flag|Martial+Arts+Violence",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines great martial arts storytelling?",
				a: "The marriage of physical poetry and philosophical depth. Every punch tells a story, every block reveals character.",
			},
		],
	},
	"kung-fu": {
		type: "all",
		label: "Kung Fu",
		path: "kung-fu",
		subtitle: "Ancient Arts Alive",
		description:
			"Shaolin discipline, wire-fu acrobatics, and masters testing their skills against modern chaos. Where every movement is meditation.",
		backdrop_path: "bJLGy57UQyJk0D0V9vYPXLcMQdx.jpg",
		discoverParams: {
			similarDNA:
				"36401926_Sub-Genres|Kung+Fu,36707627_Target+Audience|Kung+Fu+Enthusiasts,36412754_Plot|Kung+Fu+Training,36412587_Place|Shaolin+Temple,36428529_Key+Props|Shaolin+Manual",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines kung fu cinema?",
				a: "The marriage of physical mastery and spiritual growth. Violence becomes dance, combat becomes philosophy.",
			},
		],
	},
	samurai: {
		type: "all",
		label: "Samurai",
		path: "samurai",
		subtitle: "Blade Philosophy",
		description:
			"Honor codes, razor-sharp katana duels, and masters walking the line between warrior and poet. Death with dignity is the ultimate art.",
		backdrop_path: "2bHoj05gR7I5gp4oeoDCY6bU42d.jpg",
		discoverParams: {
			similarDNA:
				"36375917_Sub-Genres|Samurai+Film,36420570_Character+Types|Samurai,36728330_Plot|Samurai+Training,36444957_Target+Audience|Samurai+Film+Enthusiasts",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines samurai storytelling?",
				a: "The Bushido code's collision with human frailty. These are meditations on duty performed with steel elegance.",
			},
		],
	},
	car: {
		type: "all",
		label: "Car",
		path: "car",
		subtitle: "Horsepower Dreams",
		description:
			"Roaring engines, illegal street races, and garages where metal becomes art. Where the open road promises freedom... or destruction.",
		backdrop_path: "yaI572p8048aC0dP2oPQ32q5yrz.jpg",
		discoverParams: {
			similarDNA:
				"36398021_Key+Props|Racing+Cars,36396010_Key+Props|Customized+Cars,36377392_Plot|Car+Chases,36380668_Plot|Car+Chase,36375981_Cinematic+Style|Car+Chase+Scenes",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What drives great car stories?",
				a: "The machine as extension of self. These are tales of rebellion and control, where horsepower mirrors personal power.",
			},
		],
	},
	fighting: {
		type: "all",
		label: "Fighting",
		path: "fighting",
		subtitle: "Brawl Philosophy",
		description:
			"Underground rings, honor codes, and fighters using their bodies as both weapons and weaknesses. Pain is temporary, glory isn't.",
		backdrop_path: "rvebaEirVZ10pq2AnkxzyGnczfZ.jpg",
		discoverParams: {
			similarDNA:
				"36389686_Plot|Underground+Fighting,36375783_Plot|Street+Fights,36397014_Plot|Street+Fighting,36459090_Plot|Underground+Fighting+Ring,36377863_Place|Underground+Fight+Clubs,36429492_Plot|Underground+Fighting+Tournaments",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes fighting stories compelling?",
				a: "They're raw examinations of human limits. Every punch reveals character, every takedown exposes vulnerability.",
			},
		],
	},
	boxing: {
		type: "all",
		label: "Boxing",
		path: "boxing",
		subtitle: "Sweet Science",
		description:
			"Ring redemption, raw determination, and fighters who find themselves between the ropes. Where each punch writes autobiography in bruises.",
		backdrop_path: "zb7b40ieuRGiIc9ebIEapneaCsl.jpg",
		discoverParams: {
			similarDNA:
				"36381423_Sub-Genres|Boxing+Film,36373927_Place|Boxing+Gym,36380696_Plot|Boxing+Matches",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why are boxing stories so powerful?",
				a: "They're perfect metaphors for life's battles - one person, stripped to essentials, fighting inner demons and outer opponents.",
			},
		],
	},
}
