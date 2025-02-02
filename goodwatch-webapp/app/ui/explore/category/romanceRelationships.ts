import type { PageData } from "~/ui/explore/config"

export const romanceRelationships: Record<string, PageData> = {
	"love-story": {
		type: "all",
		label: "Love Story",
		path: "love-story",
		subtitle: "Heartbeats and Heartbreaks",
		description:
			"Electric first touches, messy breakups, and relationships that redefine 'soulmate'. Love in all its glorious, complicated forms.",
		backdrop_path: "pow3n5l3m0pvLRYcLqOnY1IWV6U.jpg",
		discoverParams: {
			similarDNA:
				"308329_Plot|First+Love,312708_Themes|Love+At+First+Sight,245241_Plot|Teenage+Romance,312350_Plot|Summer+Romance,297314_Plot|College+Romance,304329_Plot|Royal+Romance",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What elevates a love story beyond clichés?",
				a: "Authentic emotional beats and characters who grow through their relationships. It's not about perfect people, but perfect moments.",
			},
		],
	},
	"coming-of-age": {
		type: "all",
		label: "Coming of Age",
		path: "coming-of-age",
		subtitle: "Awkward Truths",
		description:
			"First loves, identity crises, and moments that turn childhoods into memories. Where growing up feels like defusing bombs blindfolded.",
		backdrop_path: "8qzaTArPaabLnf5qoqagXXnNpRb.jpg",
		discoverParams: {
			similarDNA:
				"307918_Target+Audience|Teens+%28Teenager%29,307949_Themes|Coming+Of+Age",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why do coming-of-age stories resonate?",
				a: "They capture universal growing pains - those cringe-worthy, heart-swelling moments that shape who we become.",
			},
		],
	},
	"rom-com": {
		type: "all",
		label: "Rom Com",
		path: "rom-com",
		subtitle: "Laughs & Love",
		description:
			"Awkward meet-cutes, disastrous dates, and grand gestures that walk the line between romantic and ridiculous.",
		backdrop_path: "qLDeXoAf0phZDbBEaUK0ZHOmMoA.jpg",
		discoverParams: {
			similarDNA:
				"229703_Target+Audience|Romcom+Enthusiasts,260163_Target+Audience|Rom-Com+Fans,33242_Plot|Rom-Com+Misadventures,59415_Plot|Rom-Com+Tropes,291239_Humor|Romantic+Comedy+Tropes,26057_Humor|Romantic+Satire,308060_Sub+Genre|Romantic+Comedy",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes rom-coms endure?",
				a: "The perfect cocktail of wish fulfillment and relatability. We all want to believe love can be both hilarious and heartfelt.",
			},
		],
	},
	dog: {
		type: "all",
		label: "Dog",
		path: "dog",
		subtitle: "Canine Companions",
		description:
			"Loyalty with fur, heroic rescues, and slobbery kisses that heal broken hearts. Man's best friend takes center stage.",
		backdrop_path: "3Sdi32wfIIOtDz1hYik6bGe1iWC.jpg",
		discoverParams: {
			similarDNA:
				"274730_Key+Props|Dog+Collar,303559_Key+Props|Dog,248877_Target+Audience|Dog+Lovers",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes dog stories universal?",
				a: "They tap into unconditional love and our longing for uncomplicated connections. Warning: may cause sudden urges to adopt puppies.",
			},
		],
	},
}
