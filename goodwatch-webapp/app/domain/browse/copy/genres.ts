import type { Deck, PlaceCopy } from "./types.ts"

// Keyed by the slug of the genre's TMDB name ("Science Fiction" is science-fiction, "Sci-Fi & Fantasy" is
// sci-fi-fantasy). Movie genres carry a shows text where shows are tagged with them too.

const ACTION_ADVENTURE_SHOWS: PlaceCopy = {
	short: "Fights, quests, and a new cliffhanger weekly.",
	lede: "Series that keep moving: rescue missions, treasure hunts, battles that take half a season to set up. You get movie-sized thrills with enough time to really know the crew. Very easy to binge.",
}

const SCIFI_FANTASY_SHOWS: PlaceCopy = {
	short: "Dragons, starships, and seasons to explore.",
	lede: "The home of the big worlds: space crews, magic schools, alternate timelines. A series has time to make the strange feel normal, until you know the rules better than the characters do. Expect to have opinions about the finale.",
}

const WAR_POLITICS_SHOWS: PlaceCopy = {
	short: "Power, and the people fighting over it.",
	lede: "Campaigns, coups, and wars seen from the war room and the trenches. These series follow power as it's won, traded, and lost, and they rarely pick easy sides. Smart, tense, and good for a long weekend.",
}

export const GENRES: Deck = {
	action: {
		movies: {
			short: "Chases, fights, and things blowing up.",
			lede: "Punches land, cars flip, and somebody jumps off something very tall. Action movies are about momentum, and the great ones choreograph chaos so cleanly you can follow every hit. Best on the biggest screen you have.",
		},
		shows: ACTION_ADVENTURE_SHOWS,
	},
	adventure: {
		movies: {
			short: "Pack a bag, something is out there.",
			lede: "A map, a mission, and a long way to go. Adventure movies take you over mountains, across oceans, and into places nobody has come back from, usually in good company. They're a big part of why people fall for movies as kids.",
		},
		shows: ACTION_ADVENTURE_SHOWS,
	},
	"action-adventure": {
		shows: ACTION_ADVENTURE_SHOWS,
		all: {
			short: "Chases, quests, and a long way to go.",
			lede: "Punches land, cars flip, and somebody sets off across a map with a mission. This is the shelf for momentum: fights you can follow hit by hit, journeys into places nobody has come back from, and crews you get to know along the way. Best on the biggest screen you have.",
		},
	},
	animation: {
		movies: {
			short: "Anything a pen or a computer can dream up.",
			lede: "Animation can show you anything, so it does: talking toys, spirit worlds, superheroes drawn like a comic come alive. Don't file it under kids' stuff. Some of the most beautiful and grown-up movies ever made are drawn.",
		},
		shows: {
			short: "Cartoons for kids, adults, and everyone else.",
			lede: "Animated series cover more ground than people expect: Saturday morning chaos, sharp adult comedies, and anime epics that run for hundreds of episodes. Whatever your taste, something drawn fits it.",
		},
		all: {
			short: "Anything a pen or a computer can dream up.",
			lede: "Animation can show you anything, so it does: talking toys, spirit worlds, sharp adult comedies, anime epics that run for hundreds of episodes. Don't file it under kids' stuff. Some of the most beautiful and grown-up movies and series ever made are drawn.",
		},
	},
	comedy: {
		movies: {
			short: "Built to make you laugh, one way or another.",
			lede: "From deadpan to slapstick to romantic chaos, comedy is the widest shelf there is. Some of these will have you wheezing, some are more of a steady grin. Tastes differ wildly, which is half the fun of picking one.",
		},
		shows: {
			short: "Sitcoms, sketches, and the shows you rewatch.",
			lede: "The shows you put on when you don't know what to put on. Sitcoms with a cast that feels like friends, mockumentaries, and comedies that sneak in real feelings when you're not looking. Rewatching is allowed, even encouraged.",
		},
		all: {
			short: "Built to make you laugh, one way or another.",
			lede: "From deadpan to slapstick to sitcoms with a cast that feels like friends, comedy is the widest shelf there is. Some of these will have you wheezing, some are more of a steady grin. Tastes differ wildly, which is half the fun of picking one.",
		},
	},
	crime: {
		movies: {
			short: "Cops, crooks, and the mess in between.",
			lede: "Gangsters building empires, detectives who can't let a case go, heists planned to the second. Crime movies live in the gray, where you often end up rooting for the wrong person. Expect consequences.",
		},
		shows: {
			short: "Cases, cartels, and cops with baggage.",
			lede: "A murder that takes a season to solve, a kingpin's rise and fall, a detective with a case that won't close. Crime series have time to show every angle, including the ones nobody wants to see. Cancel your plans.",
		},
		all: {
			short: "Cops, crooks, and the mess in between.",
			lede: "Gangsters building empires, detectives who can't let a case go, heists planned to the second. Crime stories live in the gray, where you often end up rooting for the wrong person. A movie gives you the job; a series gives you every angle, including the ones nobody wants to see.",
		},
	},
	documentary: {
		movies: {
			short: "True stories, told by the people in them.",
			lede: "Real life, with a camera pointed at it. One night it's a mountain climb, the next a crime, a musician, or a corner of the world you've never thought about. The good ones are as gripping as any thriller, and they happened.",
		},
		shows: {
			short: "Real stories, with room to go deep.",
			lede: "Docuseries take one subject and keep digging: a crime, a sport, a planet's worth of animals. With hours instead of minutes, they find the details a single film has to skip. Dangerous to start at midnight.",
		},
		all: {
			short: "True stories, told by the people in them.",
			lede: "Real life, with a camera pointed at it. One night it's a mountain climb, the next a crime, a musician, or a planet's worth of animals. A film gives you the story and a series keeps digging. The good ones are as gripping as any thriller, and they happened.",
		},
	},
	drama: {
		movies: {
			short: "People, problems, and no easy answers.",
			lede: "The broadest genre and maybe the most human one. Families falling apart, people at a crossroads, lives changed by a single choice. If you want to feel something real, you're in the right place.",
		},
		shows: {
			short: "The big ones everyone tells you to watch.",
			lede: "This is where television does its best work. Families, hospitals, empires, and people making choices they can't take back, followed for years. Pick one and it will be part of your life for a while.",
		},
		all: {
			short: "People, problems, and no easy answers.",
			lede: "The broadest shelf and maybe the most human one. Families falling apart, people at a crossroads, lives changed by a single choice, told in one evening or followed for years. If you want to feel something real, you're in the right place.",
		},
	},
	family: {
		movies: {
			short: "One movie the whole couch can agree on.",
			lede: "Movies made so everyone on the couch gets something: adventure for the kids, jokes that fly over their heads for you. The best ones don't talk down to anybody. Movie night, solved.",
		},
		shows: {
			short: "Shows the whole house can watch together.",
			lede: "Series that work for every age in the room. Gentle adventures, funny families, and stories with a little heart at the end. Good for the hour between dinner and bedtime.",
		},
		all: {
			short: "Something the whole couch can agree on.",
			lede: "Made so everyone in the room gets something: adventure for the kids, jokes that fly over their heads for you. The best ones don't talk down to anybody. Movie night or one more episode before bedtime, solved.",
		},
	},
	fantasy: {
		movies: {
			short: "Magic is real here, and so are dragons.",
			lede: "Wizards, quests, cursed rings, and creatures from the old stories. Fantasy invents its own rules and then makes you believe them. Ideal when the real world could use a rest.",
		},
		shows: SCIFI_FANTASY_SHOWS,
	},
	history: {
		movies: {
			short: "The past, with the dust blown off.",
			lede: "Wars, revolutions, and the people who lived through them. History movies put you inside moments you only know from books, with the mud and the fear left in. Some stick to the record, others take liberties, and most make you want to read more.",
		},
		shows: {
			short: "Past centuries, in rich detail.",
			lede: "Period series that rebuild a time and place down to the buttons. Royal courts, world wars, and old cities brought back for you to walk around in. Costume fans, this is your shelf.",
		},
	},
	horror: {
		movies: {
			short: "Made to scare you, and proud of it.",
			lede: "Ghosts, slashers, cursed tapes, and things that should have stayed buried. Horror is the genre that wants a physical reaction: a gasp, a laugh, a hand over your eyes. There's a flavor for every nerve, from quiet dread to full gore.",
		},
		shows: {
			short: "A scare that lasts all season.",
			lede: "Hauntings, curses, and monsters that have a whole season to close in. Horror series trade the quick shock for dread that builds episode by episode. Leave a light on.",
		},
	},
	kids: {
		shows: {
			short: "Made for the youngest viewers.",
			lede: "Shows made for children, from first cartoons to after-school adventures. Bright, kind, and often cleverer than they need to be. You may find yourself humming the theme songs.",
		},
	},
	music: {
		movies: {
			short: "Movies you'll want to turn up.",
			lede: "Concerts, musicals, and stories about the people who make the songs. When these work, the music does things dialogue can't, and you leave humming. Good speakers recommended.",
		},
		shows: {
			short: "Shows with a soundtrack at the center.",
			lede: "Bands on the rise, talent on stage, and stories where the songs do the talking. Music series mix performance with everything that happens backstage. Play it loud.",
		},
	},
	mystery: {
		movies: {
			short: "Something doesn't add up. Yet.",
			lede: "A locked room, a missing person, a detail that doesn't fit. Mysteries hand you the pieces and dare you to put them together first. The good ones play fair and still fool you.",
		},
		shows: {
			short: "One question, a whole season to answer it.",
			lede: "A disappearance, a small town with secrets, a detective who notices everything. Mystery series let the question hang for hours and feed you clues one at a time. You'll have a theory by the second episode, and it'll probably be wrong.",
		},
		all: {
			short: "Something doesn't add up. Yet.",
			lede: "A locked room, a missing person, a small town with secrets. Mysteries hand you the pieces and dare you to put them together first, over one evening or a whole season of clues. You'll have a theory early, and it'll probably be wrong.",
		},
	},
	news: {
		shows: {
			short: "What's going on in the world, on the record.",
			lede: "News programs, current affairs, and reporting that tries to make sense of what's happening. Some are daily habits, some are deep investigations. More for staying informed than for movie night.",
		},
	},
	reality: {
		shows: {
			short: "Real people, real drama, somewhat real.",
			lede: "Competitions, dating experiments, renovations, and people who signed up to be filmed. Reality shows are easy to mock and very hard to stop watching. Pick a favorite contestant and settle in.",
		},
	},
	romance: {
		movies: {
			short: "Falling in love, from the front row.",
			lede: "Meet-cutes, long looks, grand gestures, and the occasional airport sprint. Romance movies know what you came for and take their time getting there. Sweet, heartbreaking, or both in the same scene.",
		},
		shows: {
			short: "Love stories with time to simmer.",
			lede: "Slow burns, love triangles, and couples you'll argue about with friends. A romance series lets feelings grow at a believable pace, then makes you wait a little longer. You'll say \"one more episode\" a lot.",
		},
	},
	"science-fiction": {
		movies: {
			short: "What if, taken all the way.",
			lede: "Spaceships, time loops, machines that think, and futures we might be building right now. Science fiction asks a big what-if and follows it wherever it goes. Some of it is pure spectacle, some of it will keep you up at night.",
		},
		shows: SCIFI_FANTASY_SHOWS,
	},
	"sci-fi-fantasy": {
		shows: SCIFI_FANTASY_SHOWS,
		all: {
			short: "Dragons, starships, and what-ifs taken all the way.",
			lede: "The home of the big worlds: wizards and cursed rings, space crews and machines that think, futures we might be building right now. These stories invent their own rules and then make you believe them. Some are pure spectacle, some will keep you up at night.",
		},
	},
	soap: {
		shows: {
			short: "Love, betrayal, and a twist every episode.",
			lede: "Long-running stories where everyone has a secret and nobody stays married for long. Soaps and telenovelas run on big emotions and bigger reveals. Once you know the families, you're in for years.",
		},
	},
	talk: {
		shows: {
			short: "Good conversation, a desk, and a guest.",
			lede: "Hosts, guests, monologues, and the occasional interview everyone talks about the next day. Talk shows are television at its most relaxed. Nice to have on at the end of the day.",
		},
	},
	thriller: {
		movies: {
			short: "Trust no one and keep watching.",
			lede: "Someone is lying, someone is being followed, and time is running out. Thrillers are built on pressure: every scene costs more than the last. Don't start one late if you need to sleep.",
		},
		shows: {
			short: "Tension that tightens every episode.",
			lede: "Conspiracies, kidnappings, and secrets that come out one episode at a time. Thriller series are built to keep you pressing play on the next one. Start early in the evening.",
		},
	},
	"tv-movie": {
		movies: {
			short: "Made for the small screen, in one sitting.",
			lede: "Movies made for television instead of theaters. That means holiday romances, true-crime dramas, franchise specials, and the occasional gem that never needed a cinema. Easy to put on, easy to enjoy.",
		},
	},
	war: {
		movies: {
			short: "The front line, and what it costs.",
			lede: "Battles, yes, but mostly the people in them: scared, brave, loyal, broken. War movies can be thrilling and devastating in the same scene. The best ones leave you quiet.",
		},
		shows: WAR_POLITICS_SHOWS,
	},
	"war-politics": {
		shows: WAR_POLITICS_SHOWS,
		all: {
			short: "The front line, the war room, and what it costs.",
			lede: "Battles, coups, and campaigns, but mostly the people in them: scared, brave, loyal, broken. Some stories stay in the trenches, others follow power as it's won, traded, and lost. The best ones rarely pick easy sides and leave you quiet.",
		},
	},
	western: {
		movies: {
			short: "Dust, horses, and a score to settle.",
			lede: "Wide open country, small towns, and people who settle things themselves. Westerns can be simple tales of good and bad or slow, bitter stories about what the frontier really cost. Either way, the landscape is half the show.",
		},
		shows: {
			short: "The frontier, one long trail at a time.",
			lede: "Ranches, outlaws, and towns barely holding together. A western series lets the land and the grudges build over seasons. Slow, tough, and beautiful to look at.",
		},
		all: {
			short: "Dust, horses, and a score to settle.",
			lede: "Wide open country, small towns barely holding together, and people who settle things themselves. Westerns can be simple tales of good and bad or slow, bitter stories about what the frontier really cost. Either way, the landscape is half the show.",
		},
	},
}

/** Other spellings of a genre in addresses. */
export const GENRE_ALIASES: Record<string, string> = {
	"action-and-adventure": "action-adventure",
	"sci-fi": "science-fiction",
	scifi: "science-fiction",
	"scifi-and-fantasy": "sci-fi-fantasy",
	"sci-fi-and-fantasy": "sci-fi-fantasy",
	"war-and-politics": "war-politics",
}
