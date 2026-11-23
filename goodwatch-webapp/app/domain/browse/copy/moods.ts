import type { Deck } from "./types.ts"

// Keyed by the mood keys of domain/moods.ts.
export const MOODS: Deck = {
	funny: {
		movies: {
			short: "For when you just want to laugh.",
			lede: "Movies that are here to make you laugh, whether that takes a perfectly timed line, a pratfall, or a premise that gets sillier every minute. Some are sharp, some are gloriously dumb, and the best ones are both. Good company for a night when nothing has to matter.",
		},
		shows: {
			short: "Half an hour, a dozen good laughs.",
			lede: "Comedies you can drop into anywhere and leave in a better mood. The jokes get better the longer you know these people, which is the whole trick of a great sitcom. Put one on and suddenly it's three episodes later.",
		},
		all: {
			short: "For when you just want to laugh.",
			lede: "Here to make you laugh, whether that takes a perfectly timed line, a pratfall, or a sitcom cast you've known for years. Some are sharp, some are gloriously dumb, and the best ones are both. Pick a movie for one good night, or a series and lose count of the episodes.",
		},
	},
	feelgood: {
		movies: {
			short: "Warm, kind, and nothing bad happens for long.",
			lede: "The movie version of a blanket and something hot to drink. People are decent to each other, problems turn out to be solvable, and you can feel your shoulders drop as it goes. Perfect for a rainy Sunday or the end of a rough week.",
		},
		shows: {
			short: "Comfort shows you can live in for a while.",
			lede: "Shows that feel like visiting friends. The stakes stay gentle, the people stay kind, and there is always another episode waiting when you need one. Leave them on while you cook, or give them your whole evening.",
		},
		all: {
			short: "Warm, kind, and nothing bad happens for long.",
			lede: "The screen version of a blanket and something hot to drink. People are decent to each other, problems turn out to be solvable, and you can feel your shoulders drop as it goes. A movie for a rainy Sunday, or a show you can live in for a while.",
		},
	},
	romance: {
		movies: {
			short: "Two people, and you want it to work out.",
			lede: "Love stories, front and center. Sometimes it's the slow walk toward a first kiss, sometimes it's two people who should never have met, and sometimes it ends in tears. Either way you'll be rooting for them by the second act.",
		},
		shows: {
			short: "Will they, won't they, one more episode.",
			lede: "A series gives a love story room to breathe: seasons of glances, bad timing, and almost. By the time they finally get together, you have earned it as much as they have. Clear your schedule, because stopping mid-season is not an option.",
		},
		all: {
			short: "Two people, and you want it to work out.",
			lede: "Love stories, front and center. A movie gets you from first look to last kiss in one evening; a series makes you wait seasons for it, glances and bad timing included. Either way you'll be rooting for them long before they figure it out.",
		},
	},
	action: {
		movies: {
			short: "Big, loud, and best with the volume up.",
			lede: "Chases, fights, and set pieces built to make you grip the armrest. These movies move fast and go big, and the good ones still make you care who walks away. Turn the sound up.",
		},
		shows: {
			short: "Every episode ends on a reason to keep going.",
			lede: "Action that has hours to build and still hits hard every episode. Expect shootouts, escapes, and cliffhangers that make the next episode feel urgent. Not for winding down.",
		},
		all: {
			short: "Big, loud, and best with the volume up.",
			lede: "Chases, fights, and set pieces built to make you grip the armrest. Some are over in two breathless hours, others end every episode on a reason to keep going. The good ones still make you care who walks away.",
		},
	},
	scary: {
		movies: {
			short: "Lights off, if you dare.",
			lede: "Movies that want your pulse up and your feet off the floor. Some creep under your skin and stay there, others jump out screaming, and a few do both. Watch with someone you can grab.",
		},
		shows: {
			short: "Dread that follows you from episode to episode.",
			lede: "A scary show never has to let you off the hook: the thing in the dark can wait a whole season. Hauntings, monsters, and slow dread that follows you to bed. Maybe not right before sleep.",
		},
		all: {
			short: "Lights off, if you dare.",
			lede: "Stories that want your pulse up and your feet off the floor. A movie can jump out screaming; a series lets the thing in the dark wait a whole season. Watch with someone you can grab, and maybe not right before sleep.",
		},
	},
	mysterious: {
		movies: {
			short: "Something doesn't add up.",
			lede: "An impossible message arrives, a witness changes their story, or a stranger knows too much. These movies give you a question early and let you piece together the answer.",
		},
		shows: {
			short: "Every episode gives you another clue.",
			lede: "A small detail in the first episode can change the way you see the whole season. Pick a series to trade theories about between episodes.",
		},
		all: {
			short: "For the pleasure of figuring it out.",
			lede: "A disappearance in a small town and a strange signal from space have something in common. Both invite you to follow the clues and wonder what else you missed.",
		},
	},
	mind: {
		movies: {
			short: "You'll want to talk about it afterward.",
			lede: "Movies that bend time, logic, or reality and trust you to keep up. Dreams inside dreams, stories told backward, images you can't quite explain. You may need a second viewing, and you'll want one.",
		},
		shows: {
			short: "Strange, layered, and worth the confusion.",
			lede: "Shows that refuse to explain themselves right away. Timelines fold, rules shift, and every episode sends you looking for theories. Half the fun is being lost for a while.",
		},
		all: {
			short: "You'll want to talk about it afterward.",
			lede: "Stories that bend time, logic, or reality and trust you to keep up. Dreams inside dreams, timelines that fold, images you can't quite explain. Half the fun is being lost for a while, and the other half is the theories.",
		},
	},
	heavy: {
		movies: {
			short: "For when you need a good cry.",
			lede: "Movies about loss, longing, and the things people don't get to say in time. They hurt, and that is the point: a good one leaves you wrung out and oddly lighter. Keep tissues within reach.",
		},
		shows: {
			short: "Slow heartbreak, earned over many hours.",
			lede: "Spend enough hours with people and their losses become yours. These shows take their time with grief and regret, and they land harder for it. Not for a light evening, but worth every tear.",
		},
		all: {
			short: "For when you need a good cry.",
			lede: "Stories about loss, longing, and the things people don't get to say in time. They hurt, and that is the point: a good one leaves you wrung out and oddly lighter. Two hours or twenty, keep tissues within reach.",
		},
	},
	otherworldly: {
		movies: {
			short: "Leave Earth, or at least this version of it.",
			lede: "Kingdoms with their own maps, starships, cities a few centuries from now. These movies build a place that doesn't exist and make it feel lived in. The scale pulls you in, and the details are what you'll remember.",
		},
		shows: {
			short: "Whole worlds to move into for a few seasons.",
			lede: "A series can build a world one corner at a time: its politics, its creatures, its history. Fantasy realms and far futures that get bigger every season. Bring snacks, you'll be there a while.",
		},
		all: {
			short: "Leave Earth, or at least this version of it.",
			lede: "Kingdoms with their own maps, starships, cities a few centuries from now. A movie drops you there for an evening; a series lets you move in and learn the politics. The scale pulls you in, and the details are what you'll remember.",
		},
	},
	adventurous: {
		movies: {
			short: "Set out for somewhere new.",
			lede: "Follow an expedition into unfamiliar country, chase a clue across borders, or take the long way home. The pleasure is in what turns up along the way.",
		},
		shows: {
			short: "A new stretch of the journey each episode.",
			lede: "Travel with characters who venture beyond familiar territory. Each stop brings another discovery, a detour, or a companion for the road.",
		},
		all: {
			short: "Quests, expeditions, and the thrill of discovery.",
			lede: "These stories set out with a destination in mind. A wrong turn, a strange encounter, or an unexpected discovery can be what makes the journey.",
		},
	},
	growing: {
		movies: {
			short: "The summer everything changed.",
			lede: "Growing up, in all its awkward and wonderful mess. First loves, bad decisions, friends who feel like the whole world, and the day you see your parents as people. Everyone has one of these that feels like it was made about them.",
		},
		shows: {
			short: "Grow up alongside them, season by season.",
			lede: "Watching characters grow up over years is something only a series can do. School hallways, first heartbreaks, and friendships tested by every new season. You'll feel protective of them by the end.",
		},
		all: {
			short: "The summer everything changed.",
			lede: "Growing up, in all its awkward and wonderful mess. First loves, bad decisions, friends who feel like the whole world, and the day you see your parents as people. A movie tells it in one summer; a series lets you watch the kids grow up season by season.",
		},
	},
	tense: {
		movies: {
			short: "Quiet, tight, and hard to breathe through.",
			lede: "No explosions, no monsters, only the feeling that something is about to go wrong. A lie that might come out, a clock running down, a room nobody can leave. These movies wind you up slowly and don't let go.",
		},
		shows: {
			short: "Slow pressure that never lets up.",
			lede: "Suspense stretched over a season, where every conversation could tip things over. Secrets, double lives, and people in far over their heads. You'll hold your breath more than you expect.",
		},
		all: {
			short: "Quiet, tight, and hard to breathe through.",
			lede: "No explosions, no monsters, only the feeling that something is about to go wrong. A lie that might come out, a clock running down, a room nobody can leave. Whether it lasts an evening or a season, you'll hold your breath more than you expect.",
		},
	},
	dark: {
		movies: {
			short: "No comfort here, and no easy way out.",
			lede: "Bleak stories that look straight at the worst of people and don't flinch. Don't expect redemption or a hopeful last shot. When you're in the mood for a movie that takes the gloves off, this is where to look.",
		},
		shows: {
			short: "Bleak, heavy, and impossible to look away from.",
			lede: "Shows that stay in the dark for the long haul. Good people get worse, bad situations get no better, and hope is rationed. Heavy going, and gripping all the same.",
		},
		all: {
			short: "No comfort here, and no easy way out.",
			lede: "Bleak stories that look straight at the worst of people and don't flinch. Good people get worse, bad situations get no better, and nobody promises a hopeful last shot. Heavy going, and gripping all the same.",
		},
	},
	deep: {
		movies: {
			short: "Big questions that follow you home.",
			lede: "Movies that ask what it all means and don't pretend to have a tidy answer. Memory, death, faith, what makes a person a person. They're the ones you're still turning over days later.",
		},
		shows: {
			short: "Ideas that take a whole season to unpack.",
			lede: "Shows that use their hours to think. Questions about free will, identity, and what we owe each other, worked through one episode at a time. Great for watching with someone who likes to argue afterward.",
		},
		all: {
			short: "Big questions that follow you home.",
			lede: "Stories that ask what it all means and don't pretend to have a tidy answer. Memory, death, free will, what makes a person a person. They're the ones you're still turning over days later, preferably with someone who likes to argue.",
		},
	},
	magical: {
		movies: {
			short: "The feeling of seeing something for the first time.",
			lede: "Movies that fill you with wonder: a door that opens somewhere impossible, a creature you wish were real, a night sky that looks too big. They make you feel like a kid again in the best way. Good for all ages, including yours.",
		},
		shows: {
			short: "Wonder, a little at a time.",
			lede: "Shows where the impossible keeps happening and nobody gets tired of it. Hidden doors, strange gifts, and worlds that open a little wider each episode. Watch with kids or without, it works both ways.",
		},
		all: {
			short: "The feeling of seeing something for the first time.",
			lede: "Stories that fill you with wonder: a door that opens somewhere impossible, a creature you wish were real, a night sky that looks too big. They make you feel like a kid again in the best way. Watch with kids or without, it works both ways.",
		},
	},
	quirky: {
		movies: {
			short: "Odd people doing things their own way.",
			lede: "Movies about oddballs, misfits, and plans that make sense only to the people in them. The humor is offbeat, the details are particular, and nothing goes the way a normal movie would. If you like your stories a little crooked, start here.",
		},
		shows: {
			short: "Strange little worlds full of strange people.",
			lede: "Shows built around eccentrics and the peculiar corners they live in. Deadpan jokes, odd rituals, and characters you'd cross the street to avoid and still love watching. Give it two episodes to get on its wavelength.",
		},
		all: {
			short: "Odd people doing things their own way.",
			lede: "Oddballs, misfits, and plans that make sense only to the people in them. The humor is offbeat, the details are particular, and nothing goes the way a normal story would. If you like things a little crooked, start here, and give it a minute to get on its wavelength.",
		},
	},
}

/** Other ways a mood is named in addresses: its display name and earlier names. */
export const MOOD_ALIASES: Record<string, string> = {
	cozy: "feelgood",
	"feel-good": "feelgood",
	romantic: "romance",
	thrilling: "action",
	trippy: "mind",
	"mind-bending": "mind",
	sad: "heavy",
	"growing-up": "growing",
}
