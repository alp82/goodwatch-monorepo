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
				"36374793_Plot|First+Love,36375984_Themes|Love+At+First+Sight,36380636_Plot|Teenage+Romance,36374189_Plot|Summer+Romance,36375996_Plot|Worklplace+Romance,36375132_Plot|Unconventional+Romance",
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
				"36375776_Target+Audience|Teenagers,36373044_Sub-Genres|Coming-Of-Age,36373007_Sub-Genres|Coming-Of-Age+Drama",
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
				"36374500_Sub-Genres|Romantic+Comedy,36374514_Humor|Romantic+Comedy,36469845_Target+Audience|Rom-Com+Fans,36417593_Plot|Rom-Com+Hijinks,36715059_Plot|Rom-Com+Misunderstandings,36436803_Humor|Romantic+Satire",
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
				"36639029_Character+Types|Dog+Companion,36394609_Key+Props|Dog+Collar,36379609_Key+Props|Dog,36427029_Key+Props|Puppy,36420520_Target+Audience|Dog+Lovers",
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
