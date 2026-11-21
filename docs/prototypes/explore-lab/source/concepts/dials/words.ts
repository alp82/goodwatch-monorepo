// PROTOTYPE - throwaway (prototype/explore-r4, concept "dials"). The words on the dials. Hand-written, in the voice of
// someone handing you a remote: a dial asks a plain question, and every stop has a name and a line. No numbers.

export type AxisId = "tone" | "pace" | "world" | "mind"

interface DialText {
	question: string
	low: string
	high: string
	/** Stop names relative to the place: within Cozy, "Darkest" is the darkest cozy movie. */
	stops: [string, string, string, string, string]
	blurbs: [string, string, string, string, string]
	/** Stop names across everything (the hub). */
	absolute: [string, string, string, string, string]
}

export const AXIS_TEXT: Record<AxisId, DialText> = {
	tone: {
		question: "Lighter or darker?",
		low: "Lighter",
		high: "Darker",
		stops: ["Lightest", "Lighter", "In between", "Darker", "Darkest"],
		absolute: ["Sunny", "Bright", "Bittersweet", "Dark", "Pitch black"],
		blurbs: [
			"The sunniest ones. Nothing heavy here.",
			"On the bright side, with a little shade.",
			"Light and shadow in balance.",
			"Things get heavy. Bring some nerve.",
			"The bleakest. Don't expect a happy ending.",
		],
	},
	pace: {
		question: "Calm or intense?",
		low: "Calmer",
		high: "More intense",
		stops: ["Calmest", "Calmer", "In between", "More intense", "Most intense"],
		absolute: ["Still", "Gentle", "Steady", "Tense", "Relentless"],
		blurbs: [
			"The quiet ones. Long looks, slow evenings.",
			"Unhurried, with a pulse.",
			"It moves, and you can still breathe.",
			"Tight and tense. Hard to look away.",
			"Full throttle, start to finish.",
		],
	},
	world: {
		question: "Real or fantastic?",
		low: "More real",
		high: "More fantastic",
		stops: ["Most real", "More real", "In between", "More fantastic", "Most fantastic"],
		absolute: ["True to life", "Grounded", "Heightened", "Fantastical", "Another world"],
		blurbs: [
			"As real as it gets. Could be your street.",
			"Our world, more or less.",
			"One foot in reality, one somewhere else.",
			"Magic, monsters or far futures.",
			"Somewhere else entirely.",
		],
	},
	mind: {
		question: "Easy or demanding?",
		low: "Easier",
		high: "More demanding",
		stops: ["Easiest", "Easier", "In between", "More demanding", "Most demanding"],
		absolute: ["Easygoing", "Comfortable", "Engaging", "Layered", "A puzzle box"],
		blurbs: [
			"Easy to love, nothing to work out.",
			"Clear and comfortable.",
			"Asks a little, gives a lot.",
			"Layered. Pay attention.",
			"A puzzle box. Worth watching twice.",
		],
	},
}

export const REACH_TEXT = {
	question: "Big hits or hidden gems?",
	low: "Big hits",
	high: "Hidden gems",
	stops: ["Big hits", "Well known", "In between", "Lesser known", "Hidden gems"],
	blurbs: [
		"The ones everybody has heard of.",
		"Familiar names, a few you may have missed.",
		"Known to people who look around a bit.",
		"Off the front page, and worth the detour.",
		"Loved by the few who found them.",
	],
} as const

export const LOVE_TEXT = {
	question: "Critics or the crowd?",
	low: "Critics' picks",
	high: "Crowd favorites",
	stops: [
		"Critics' picks",
		"Critics lean in",
		"Everyone agrees",
		"The crowd leans in",
		"Crowd favorites",
	],
	blurbs: [
		"Critics rate these far higher than audiences do.",
		"A little more loved by critics than by the crowd.",
		"Critics and audiences land on the same score.",
		"A little more loved by audiences than by critics.",
		"Audiences rate these far higher than critics do.",
	],
} as const

export const AGE_TEXT = {
	question: "Old or new?",
	low: "Older",
	high: "Newer",
	stops: ["Oldest", "Older", "In between", "Newer", "Newest"],
	blurbs: [
		"The oldest on the list.",
		"From the earlier decades.",
		"From the middle of film history.",
		"From the last few decades.",
		"The most recent to make the list.",
	],
} as const

/** A trait in three bands that feel like three different evenings. Hand-written for the traits people reach for. */
export interface Evening {
	headline: string
	line: string
}
type Evenings = { touch: Evening; plenty: Evening; full: Evening }

const EVENINGS: Record<string, Evenings> = {
	scare: {
		touch: {
			headline: "A shiver now and then",
			line: "Mostly something else: a thriller, a drama, a dark comedy. A few moments make you pull the blanket up.",
		},
		plenty: {
			headline: "Lights on, please",
			line: "Real horror with real dread. You'll jump, you'll check the hallway, and you'll sleep fine. Probably.",
		},
		full: {
			headline: "Sleep is cancelled",
			line: "The ones people dare each other to watch. Relentless, nasty, and not for a quiet night in.",
		},
	},
	wholesome: {
		touch: {
			headline: "A warm corner",
			line: "Not a comfort watch as such, but there's a good heart in it and you'll come out a little lighter.",
		},
		plenty: {
			headline: "A proper hug",
			line: "Decent people being decent to each other. Put it on when the week has been too much.",
		},
		full: {
			headline: "Pure sunshine",
			line: "Nothing but kindness from start to finish. Good for all ages and every bad mood.",
		},
	},
	romance: {
		touch: {
			headline: "A spark on the side",
			line: "The story is about something else, and two people keep looking at each other anyway.",
		},
		plenty: {
			headline: "A real love story",
			line: "The relationship is the reason to watch. You'll root for them and argue about the ending.",
		},
		full: {
			headline: "Head over heels",
			line: "Love is everything here: the longing, the grand gestures, the tears. Bring tissues.",
		},
	},
	adrenaline: {
		touch: {
			headline: "A quickened pulse",
			line: "A chase here, a close call there. Enough to sit up for, not enough to wear you out.",
		},
		plenty: {
			headline: "Edge of the seat",
			line: "Set pieces that keep coming. You'll forget your drink is in your hand.",
		},
		full: {
			headline: "No brakes",
			line: "Two hours of full speed. Turn the sound up and warn the neighbors.",
		},
	},
	tension: {
		touch: {
			headline: "Something's off",
			line: "A quiet unease under the story. You notice you've stopped looking at your phone.",
		},
		plenty: {
			headline: "Holding your breath",
			line: "The screws tighten scene by scene. You'll want to pause and won't.",
		},
		full: {
			headline: "Unbearable, in a good way",
			line: "Wound as tight as it goes, from the first minute to the last.",
		},
	},
	melancholy: {
		touch: {
			headline: "A quiet ache",
			line: "A wistful note under everything. It stays with you on the walk home.",
		},
		plenty: {
			headline: "A good cry",
			line: "Sad and beautiful, and it earns every tear.",
		},
		full: {
			headline: "Heartbreak",
			line: "The ones that flatten you. Watch when you're ready, and maybe not alone.",
		},
	},
	"situational-comedy": {
		touch: {
			headline: "A few good laughs",
			line: "Not a comedy, but funny when it wants to be. The laughs catch you off guard.",
		},
		plenty: {
			headline: "Properly funny",
			line: "Built to make you laugh, and it does, scene after scene.",
		},
		full: {
			headline: "Can't breathe",
			line: "Jokes on top of jokes. You'll miss half of them laughing at the other half.",
		},
	},
	"dark-humor": {
		touch: {
			headline: "A wicked streak",
			line: "Serious on the surface, with a grin it can't quite hide.",
		},
		plenty: {
			headline: "Laughing when you shouldn't",
			line: "Terrible things, played for laughs. You'll feel bad about it later.",
		},
		full: {
			headline: "Pitch black",
			line: "Nothing is sacred. For people who think the worst jokes are the best ones.",
		},
	},
	surrealism: {
		touch: {
			headline: "A little strange",
			line: "Mostly the world as you know it, with a few scenes that follow dream logic.",
		},
		plenty: {
			headline: "Down the rabbit hole",
			line: "Reality bends and nobody explains why. Go with it.",
		},
		full: {
			headline: "Pure dream",
			line: "Don't try to follow the plot. Let the images do what they came to do.",
		},
	},
	violence: {
		touch: {
			headline: "It gets rough",
			line: "A fight or two, and a moment that makes you wince.",
		},
		plenty: {
			headline: "Not for the squeamish",
			line: "The violence matters to the story, and the camera doesn't look away.",
		},
		full: {
			headline: "Brutal",
			line: "As hard as it gets. Know what you're in for before you press play.",
		},
	},
	wonder: {
		touch: {
			headline: "A glimpse of magic",
			line: "An ordinary story that opens a window onto something bigger now and then.",
		},
		plenty: {
			headline: "Eyes wide",
			line: "Worlds and sights that make you feel like a kid in the front row.",
		},
		full: {
			headline: "Jaw on the floor",
			line: "Awe from the first frame. See it on the biggest screen you have.",
		},
	},
	"slow-burn": {
		touch: {
			headline: "Takes its time",
			line: "It moves along, and it lets a few scenes breathe.",
		},
		plenty: {
			headline: "A slow simmer",
			line: "Patience pays off. The last act lands because of everything before it.",
		},
		full: {
			headline: "Barely moving, fully gripping",
			line: "Long takes, long silences. Put the phone in another room.",
		},
	},
}

export function eveningsFor(slug: string, adj: string): Evenings {
	return (
		EVENINGS[slug] ?? {
			touch: {
				headline: `A little ${adj}`,
				line: "It's in the mix, and something else runs the show.",
			},
			plenty: {
				headline: `Properly ${adj}`,
				line: "You'll feel it the whole way through.",
			},
			full: {
				headline: `As ${adj} as it gets`,
				line: "Nothing held back. This is the reason these exist.",
			},
		}
	)
}
