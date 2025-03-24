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
				"36374073_Character+Types|Detective,36374217_Plot|Detective+Work,36379826_Key+Props|Detective%27s+Notebook,36380260_Plot|Detective+Investigations,36432025_Character+Types|Female+Detective,36390177_Key+Props|Crime+Scene+Evidence,36390104_Plot|Crime+Scene+Investigation",
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
				"36373851_Plot|Heist+Planning,36373863_Sub-Genres|Heist+Film,36375977_Plot|High-Stakes+Heist,36394816_Key+Props|Heist+Tools",
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
				"36375352_Plot|Murder+Mystery,36428263_Sub-Genres|True+Crime,40054424_Narrative|Murder+Mystery,40084311_Plot|Murder+Mystery+Game,40171285_Plot|Mystery+Murder,40097677_Plot|Past+Murder+Mystery",
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
				"36383356_Character+Types|Gangster,36406733_Character+Types|Crime+Boss,36374356_Sub-Genres|Gangster+Film,36414480_Plot|Rise+And+Fall+Of+A+Criminal+Empire",
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
				"36373658_Themes|Justice+Vs.+Revenge,36373089_Plot|Revenge+Plot,36375826_Themes|Revenge,36384615_Mood|Revengeful,36373657_Themes|The+Cost+Of+Revenge,36444033_Plot|Blood+Feud+%28Revenge+Drama%29,36552671_Plot|Payback",
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
				"36385183_Sub-Genres|Mafia+Film,36400587_Plot|Mafia+Involvement,36399684_Plot|Mafia+Mafia Infiltration,36419649_Character+Types|Mafia+Boss,36397621_Character+Types|Mob+Boss,36444479_Plot|Mafia+Politics,36374356_Sub-Genres|Gangster+Film",
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
				"36374039_Plot|Serial+Killer+Pursuit,36385962_Plot|Serial+Killer+On+The+Loose,36376510_Character+Types|Serial+Killer,36379825_Plot|Serial+Killer,36402559_Plot|Serial+Killings",
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
				"36398440_Character+Types|Mobster,36397621_Character+Types|Mob Boss,36406733_Character+Types|Crime+Boss,36408533_Plot|Mob+Involvement,36451772_Plot|Mobster+Life",
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
				"36375331_Character+Types|Spy,36377773_Sub-Genres|Spy+Comedy,36375643_Sub-Genres|Spy+Thriller,36376048_key+Props|Spy+Gadgets,36378711_Plot|Spy+Missions",
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
