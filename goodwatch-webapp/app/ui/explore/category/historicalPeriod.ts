import type { PageData } from "~/ui/explore/config"

export const historicalPeriod: Record<string, PageData> = {
	ww2: {
		type: "all",
		label: "WW2",
		path: "ww2",
		subtitle: "Global Conflict Stories",
		description:
			"Frontline heroism, homefront sacrifices, and moral choices in impossible circumstances. History that feels urgent enough to dust off your grandfather's medals.",
		backdrop_path: "mrPT9CpjjvACGuHpCILHTRCHhYb.jpg",
		discoverParams: {
			similarDNA: "36375538_Time|World+War+Ii,36416588_Time|World+War+I+Era",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "How do WW2 stories stay fresh?",
				a: "By focusing on untold perspectives - resistance fighters, codebreakers, ordinary citizens forced into extraordinary roles.",
			},
		],
	},
	medieval: {
		type: "all",
		label: "Medieval",
		path: "medieval",
		subtitle: "Dark Age Drama",
		description:
			"Castle intrigues, muddy battlefield honor, and peasant uprisings. Where a sword's edge separates serfs from sovereignty.",
		backdrop_path: "a0yry0OKdBl1G1Dv6H6BeIW2ER1.jpg",
		discoverParams: {
			similarDNA:
				"36374205_Time|Medieval+Times,36442944_Time|Medieval+Fantasy,36378948_Costume+and+Set|Medieval+Sets",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes medieval stories resonate?",
				a: "They're power struggles writ large - raw human ambition without modern technology to soften the edges.",
			},
		],
	},
	"true-story": {
		type: "all",
		label: "True Story",
		path: "true-story",
		subtitle: "Real Life Drama",
		description:
			"Unbelievable biopics, stranger-than-fiction events, and ordinary people facing extraordinary circumstances. Reality's greatest hits.",
		backdrop_path: "oK9UByMkurtsUYFsJB7V1CdiXfD.jpg",
		discoverParams: {
			similarDNA:
				"36373847_Cultural+Impact|Based+On+A+True+Story,36380585_Cultural+Impact|Based+On+True+Events",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What elevates true story adaptations?",
				a: "The knowledge that these events happened adds weight. The best ones honor truth while embracing cinematic storytelling.",
			},
		],
	},
	business: {
		type: "all",
		label: "Business",
		path: "business",
		subtitle: "Corporate Warfare",
		description:
			"Hostile takeovers, startup gambles, and boardroom battles where PowerPoint is mightier than the sword. Profit margins hide human costs.",
		backdrop_path: "blbA7NEHARQOWy5i9VF5K2kHrPc.jpg",
		discoverParams: {
			similarDNA:
				"36377101_Plot|Business+Rivalry,36387053_Key+Props|Business+Documents,36406938_Plot|Business+Startup,36425290_Plot|Business+Ventures",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What drives business storytelling?",
				a: "The drama of ambition meeting reality. These are modern power plays where spreadsheets can destroy lives and create empires.",
			},
		],
	},
}
