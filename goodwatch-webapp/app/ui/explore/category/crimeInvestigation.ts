import type { PageData } from "~/ui/explore/config"

export const crimeInvestigation: Record<string, PageData> = {
	detective: {
		type: "all",
		label: "Detective",
		path: "detective",
		subtitle: "Mystery Solvers Extraordinaire",
		description:
			"Smoke-filled offices, cryptic clues, and suspects who all have something to hide. Where every answer leads to three new questions.",
		backdrop_path: "bPLRjO2pcBx0WL73WUPzuNzQ3YN.jpg",
		discoverParams: {
			similarDNA:
				"308193_Character+Types|Detective,308831_Plot|Detective+Work,315045_Key+Props|Detective%27s+Notebook,308925_Plot|Detective+Investigations,301812_Character+Types|Female+Detective,308073_Key+Props|Crime+Scene+Evidence,309586_Target+Audience|Crime+Drama+Enthusiasts",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes detective stories compelling?",
				a: "The intellectual thrill of puzzle-solving combined with deep character studies. The best detectives are as complex as their cases.",
			},
		],
	},
	heist: {
		type: "all",
		label: "Heist",
		path: "heist",
		subtitle: "High-Stakes Gambits",
		description:
			"Meticulous plans, unexpected snafus, and crews where the biggest threat might be each other. The perfect blend of brains and brute force.",
		backdrop_path: "l9QRe9V5e5qghzXlre1B3cyg4Tc.jpg",
		discoverParams: {
			similarDNA:
				"308979_Plot|Heist+Planning,308991_Sub-Genres|Heist+Film,301810_Key+Props|Heist+Tools",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes a great heist story?",
				a: "The delicate balance between meticulous planning and chaotic execution. It's chess meets demolition derby.",
			},
		],
	},
	"murder-mystery": {
		type: "all",
		label: "Murder Mystery",
		path: "murder-mystery",
		subtitle: "Deadly Puzzles",
		description:
			"Blood-stained clues, alibis that don't add up, and killers hiding in plain sight. The ultimate game of cat and mouse where everyone's a suspect.",
		backdrop_path: "fkdMSS93pFBzNW9OByNpi8i2UYg.jpg",
		discoverParams: {
			similarDNA:
				"308842_Plot|Murder+Mystery,297471_Plot|Suburban+Murder+Mystery,1950856_Plot|True-Crime+Murder+Mystery,4737968_Plot|Mystery+Of+The+Murderer,5103520_Plot|Mass+Murder+Mystery",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What separates murder mysteries from regular crime stories?",
				a: "The focus on puzzle-solving logic - the audience gets all the clues needed to solve the case alongside the detective.",
			},
		],
	},
	gangster: {
		type: "all",
		label: "Gangster",
		path: "gangster",
		subtitle: "Underworld Ascending",
		description:
			"Smoke-filled speakeasies, loyalty tests, and empires built on bullets. Where the line between businessman and criminal blurs.",
		backdrop_path: "suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
		discoverParams: {
			similarDNA:
				"300524_Character+Types|Gangster,295198_Character+Types|Crime+Boss+%28Gangster+Underworld%29,300605_Plot|Mob+Wars+%28Gangster+Warfare%29,265385_Plot|Criminal+Rise+To+Power+%28Gangster+Rise+To+Power%29",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines gangster storytelling?",
				a: "The rise-and-fall structure showing how ambition corrupts. These are Shakespearean tragedies with tommy guns.",
			},
		],
	},
	revenge: {
		type: "all",
		label: "Revenge",
		path: "revenge",
		subtitle: "Payback's a Bite",
		description:
			"Slow-burn vengeance, elaborate traps, and moral lines crossed in red ink. Cold dishes best served with colder calculation.",
		backdrop_path: "swpjSgGmBCx6QgfO4rgv5vBzqHL.jpg",
		discoverParams: {
			similarDNA:
				"292373_Themes|Justice+Vs.+Revenge,310184_Plot|Revenge+Plot,308751_Themes|Revenge",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes revenge stories compelling?",
				a: "The dark satisfaction of justice served raw, paired with the inevitable question: does vengeance heal or destroy?",
			},
		],
	},
	mafia: {
		type: "all",
		label: "Mafia",
		path: "mafia",
		subtitle: "Family Business",
		description:
			"Omertà oaths, territory wars, and Sunday dinners where the lasagna hides blood money. Loyalty always comes with a body count.",
		backdrop_path: "gILte6Zd7m1YneIr6MVhh30S9pr.jpg",
		discoverParams: {
			similarDNA:
				"245595_Sub-Genres|Mafia+Film,293149_Plot|Criminal+Underworld+%28Mafia+Activities%29,295198_Character+Types|Crime+Boss+%28Mafia+Boss%29,279887_Plot|Underworld+Politics+%28Mafia+Politics%29",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines mafia stories?",
				a: "The tension between criminal enterprise and twisted family values. Honor among thieves has never been so complicated.",
			},
		],
	},
	"serial-killer": {
		type: "all",
		label: "Serial Killer",
		path: "serial-killer",
		subtitle: "Mind Hunters",
		description:
			"Chilling patterns, psychological cat-and-mouse, and the question: are monsters born or made? Sleep with the lights on.",
		backdrop_path: "tZ358Wk4BnOc4FjdGsiexAUvCMH.jpg",
		discoverParams: {
			similarDNA:
				"309626_Plot|Serial+Killer+Pursuit,303056_Plot|Serial+Killer+On+The+Loose,228595_Key+Props|Serial+Killer%27s+Trophies,287726_Plot|Serial+Killings,7946_Plot|Serial+Killing+Spree",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes serial killer stories compelling?",
				a: "They dissect the banality of evil, exploring how darkness hides in plain sight. The real horror is the killer could be anyone.",
			},
		],
	},
	mob: {
		type: "all",
		label: "Mob",
		path: "mob",
		subtitle: "Criminal Empire",
		description:
			"Protection rackets, rival families, and Byzantine power structures where trust is the ultimate currency. The business of crime is still business.",
		backdrop_path: "hsofdfyJos7CXUOODP1XaYosFcK.jpg",
		discoverParams: {
			similarDNA:
				"239861_Plot|Mob+Involvement,213570_Plot|Mobster+Life,295198_Character+Types|Crime+Boss",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "How do mob stories differ from other crime tales?",
				a: "They focus on the organization over individuals - the complex ecosystem of loyalty, tradition, and power that makes the mob a dark mirror of legitimate society.",
			},
		],
	},
	spy: {
		type: "all",
		label: "Spy",
		path: "spy",
		subtitle: "Covert Operations",
		description:
			"Dead drops, double agents, and tradecraft where trust is a luxury no one can afford. In the shadow war, truth is the first casualty.",
		backdrop_path: "8gaS9YFtarOdDrOSdZkNvgBplCg.jpg",
		discoverParams: {
			similarDNA:
				"296353_Character+Types|Spy,316163_Sub-Genres|Spy+Comedy,312749_Sub-Genres|Spy+Thriller",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines great spy stories?",
				a: "The psychological chess game of secrets and lies. The best ones show how living in shadows affects those who serve in silence.",
			},
		],
	},
}
