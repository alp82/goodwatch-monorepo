// Tropes: the storytelling devices TV Tropes names, as a Browse family
// (`/movies/tropes`, `/movies/tropes/chekhovs-gun`). Which titles carry a trope comes from the per-title `trope` rows
// that production already reads for the title pages' Tropes section (server/browse/tropes.server.ts). This file is the hand-made
// part: which tropes get a page, how they group, the one-liner GoodWatch says for each (our own words, never TV Tropes
// text), and which trope it contrasts with. Pure: loader and browser.

export type TropeGroupId =
	| "endings"
	| "machinery"
	| "villains"
	| "heroes"
	| "karma"
	| "romance"
	| "comedy"
	| "action"
	| "fright"
	| "family"
	| "winks"

export interface TropeGroup {
	id: TropeGroupId
	/** The index's heading. */
	name: string
	/** What the group is about, in one line. */
	line: string
	/** The group's accent (a hex color that reads on the dark page). */
	color: string
}

export const TROPE_GROUPS: readonly TropeGroup[] = [
	{
		id: "endings",
		name: "How it ends",
		line: "The last ten minutes, named.",
		color: "#f59e0b",
	},
	{
		id: "machinery",
		name: "Plot machinery",
		line: "The gears you only notice the second time.",
		color: "#38bdf8",
	},
	{
		id: "villains",
		name: "The other side",
		line: "How the bad guys are built.",
		color: "#f43f5e",
	},
	{
		id: "heroes",
		name: "People worth following",
		line: "Leads, misfits, and the odd jerk you end up liking.",
		color: "#34d399",
	},
	{
		id: "karma",
		name: "What goes around",
		line: "Punishments, rewards, and the ones who get away with it.",
		color: "#a78bfa",
	},
	{
		id: "romance",
		name: "Love stories",
		line: "Glances, sparks, and the long way round.",
		color: "#f472b6",
	},
	{
		id: "comedy",
		name: "How jokes are built",
		line: "Setups, payoffs, and the gag that won't die.",
		color: "#facc15",
	},
	{
		id: "action",
		name: "Fights and feats",
		line: "Last-second rescues and one-sided battles.",
		color: "#fb923c",
	},
	{
		id: "fright",
		name: "What scares",
		line: "Monsters, end times, and the thing in the dark.",
		color: "#22d3ee",
	},
	{
		id: "family",
		name: "Ties that bind",
		line: "Parents, siblings, and the friends who count as both.",
		color: "#86efac",
	},
	{
		id: "winks",
		name: "Winks at you",
		line: "Cameos, title drops, and the story pointing at itself.",
		color: "#c4b5fd",
	},
]

export interface Trope {
	/** The TV Tropes page name: `ChekhovsGun` (the page is `https://tvtropes.org/pmwiki/pmwiki.php/Main/<id>`). */
	id: string
	/** Our address segment: `chekhovs-gun`. */
	slug: string
	/** The trope's name as people say it. */
	label: string
	group: TropeGroupId
	/** GoodWatch's one-liner: what the trope is, said short. */
	line: string
	/** After the kind noun in a page's name: "Movies with a Chekhov's Gun". */
	say: string
	/** The trope it plays against, by id. */
	vs?: string
	/**
	 * TV Tropes leaves spoilers unmarked on its Ending and Death trope pages (the page itself is the
	 * warning), so a write-up there gives away how a story ends without any spoiler mark. On these tropes every
	 * write-up is held back as a whole.
	 */
	spoilersOff: boolean
}

/** TV Tropes' Ending and Death tropes among ours, plus the karma tropes that are an ending by nature. */
const SPOILERS_OFF = new Set([
	"HeroicSacrifice",
	"KarmicDeath",
	"TakingYouWithMe",
	"MentorOccupationalHazard",
	"AnyoneCanDie",
	"TheBadGuyWins",
	"KarmaHoudini",
	"LaserGuidedKarma",
	"HoistByHisOwnPetard",
	"AssholeVictim",
	"TheReveal",
	"WhamLine",
])

type Raw = [id: string, label: string, line: string, say?: string, vs?: string]

const RAW: Record<TropeGroupId, Raw[]> = {
	endings: [
		[
			"BittersweetEnding",
			"Bittersweet Ending",
			"They won. It cost them something they'll miss.",
			"with a bittersweet ending",
			"DownerEnding",
		],
		[
			"DownerEnding",
			"Downer Ending",
			"It ends badly, and it means to.",
			"with a downer ending",
			"EarnYourHappyEnding",
		],
		[
			"EarnYourHappyEnding",
			"Earn Your Happy Ending",
			"The happy ending, paid for in full.",
			"that earn their happy ending",
			"DownerEnding",
		],
		[
			"TwistEnding",
			"Twist Ending",
			"The last scene rewrites every scene before it.",
			"with a twist ending",
		],
		[
			"AmbiguousEnding",
			"Ambiguous Ending",
			"The credits roll and the argument starts.",
			"with an ambiguous ending",
		],
		[
			"ShootTheShaggyDog",
			"Shoot the Shaggy Dog",
			"All that effort, and it came to nothing.",
			"where it all comes to nothing",
			"EarnYourHappyEnding",
		],
		[
			"TheBadGuyWins",
			"The Bad Guy Wins",
			"Evil goes home happy.",
			"where the bad guy wins",
			"EarnYourHappyEnding",
		],
		["BookEnds", "Book Ends", "It ends where it began, on purpose.", "that end where they began"],
		[
			"DistantFinale",
			"Distant Finale",
			"The last scene jumps years ahead.",
			"with a distant finale",
		],
		[
			"WhereAreTheyNowEpilogue",
			"Where Are They Now Epilogue",
			"Title cards tell you how everyone turned out.",
			"with a where-are-they-now epilogue",
		],
		["SequelHook", "Sequel Hook", "One thread left dangling for next time.", "with a sequel hook"],
	],
	machinery: [
		[
			"ChekhovsGun",
			"Chekhov's Gun",
			"Shown early, fired late.",
			"with a Chekhov's Gun",
			"RedHerring",
		],
		[
			"Foreshadowing",
			"Foreshadowing",
			"The ending was there all along, in plain sight.",
			"full of foreshadowing",
		],
		[
			"ChekhovsSkill",
			"Chekhov's Skill",
			"An odd talent, mentioned once, saves the day.",
			"with a Chekhov's Skill",
		],
		[
			"ChekhovsGunman",
			"Chekhov's Gunman",
			"The face in the background turns out to matter.",
			"with a Chekhov's Gunman",
		],
		[
			"RedHerring",
			"Red Herring",
			"The clue that points the wrong way.",
			"with a red herring",
			"ChekhovsGun",
		],
		[
			"MacGuffin",
			"MacGuffin",
			"Everyone wants it. What it is barely matters.",
			"chasing a MacGuffin",
		],
		["WhamLine", "Wham Line", "One sentence, and nothing is the same.", "with a wham line"],
		["TheReveal", "The Reveal", "The truth comes out and every scene shifts.", "with a big reveal"],
		[
			"BaitAndSwitch",
			"Bait-and-Switch",
			"Sets up one thing, delivers another.",
			"that bait and switch",
		],
		[
			"UnreliableNarrator",
			"Unreliable Narrator",
			"The one telling the story can't be trusted.",
			"with an unreliable narrator",
		],
		[
			"InMediasRes",
			"In Medias Res",
			"It starts in the middle and catches up.",
			"that start in the middle",
		],
		[
			"DeusExMachina",
			"Deus ex Machina",
			"Rescued by something nobody set up.",
			"saved by a deus ex machina",
			"ChekhovsGun",
		],
	],
	villains: [
		["BigBad", "Big Bad", "The one behind all of it.", "with a Big Bad"],
		[
			"AffablyEvil",
			"Affably Evil",
			"Polite, charming, and absolutely the villain.",
			"with an affably evil villain",
			"FauxAffablyEvil",
		],
		[
			"FauxAffablyEvil",
			"Faux Affably Evil",
			"The good manners are a mask, and it slips.",
			"with a faux-affable villain",
			"AffablyEvil",
		],
		[
			"KickTheDog",
			"Kick the Dog",
			"One cruel act tells you who they are.",
			"where someone kicks the dog",
			"PetTheDog",
		],
		[
			"EvenEvilHasStandards",
			"Even Evil Has Standards",
			"There's a line even they won't cross.",
			"where even evil has standards",
		],
		["AxCrazy", "Ax-Crazy", "Violent, unpredictable, and enjoying it.", "with someone ax-crazy"],
		[
			"VillainousBreakdown",
			"Villainous Breakdown",
			"The composure cracks when the plan fails.",
			"with a villainous breakdown",
		],
		[
			"WellIntentionedExtremist",
			"Well-Intentioned Extremist",
			"Right about the problem, monstrous about the fix.",
			"with a well-intentioned extremist",
		],
		[
			"ManipulativeBastard",
			"Manipulative Bastard",
			"Pulls every string, never gets dirty hands.",
			"with a manipulator pulling strings",
		],
		[
			"TheDragon",
			"The Dragon",
			"The villain's right hand, and the first big fight.",
			"with a villain's right hand",
		],
		[
			"SmugSnake",
			"Smug Snake",
			"Thinks they're the smartest in the room. Isn't.",
			"with a smug snake",
		],
	],
	heroes: [
		[
			"JerkWithAHeartOfGold",
			"Jerk with a Heart of Gold",
			"Rude on the outside, decent where it counts.",
			"with a jerk with a heart of gold",
			"Jerkass",
		],
		[
			"Jerkass",
			"Jerkass",
			"Unpleasant, start to finish.",
			"with a proper jerk",
			"JerkWithAHeartOfGold",
		],
		[
			"DeadpanSnarker",
			"Deadpan Snarker",
			"Meets every crisis with a dry remark.",
			"with a deadpan snarker",
		],
		[
			"PetTheDog",
			"Pet the Dog",
			"One kind act, and you're on their side.",
			"where someone pets the dog",
			"KickTheDog",
		],
		[
			"HeroicSacrifice",
			"Heroic Sacrifice",
			"Gives their life so the others keep theirs.",
			"with a heroic sacrifice",
		],
		[
			"HeroicBSOD",
			"Heroic BSoD",
			"The hero breaks down, and the plot waits.",
			"where the hero breaks down",
		],
		[
			"TookALevelInBadass",
			"Took a Level in Badass",
			"The pushover comes back dangerous.",
			"where someone takes a level in badass",
		],
		["AntiHero", "Anti-Hero", "You root for them anyway.", "with an anti-hero"],
		["TheStoic", "The Stoic", "Feels everything, shows nothing.", "with a stoic"],
		[
			"FishOutOfWater",
			"Fish out of Water",
			"Dropped into a world that makes no sense to them.",
			"with a fish out of water",
		],
		["ActionGirl", "Action Girl", "She does the fighting herself.", "with an action girl"],
	],
	karma: [
		[
			"LaserGuidedKarma",
			"Laser-Guided Karma",
			"The punishment fits the crime exactly.",
			"with laser-guided karma",
			"KarmaHoudini",
		],
		[
			"KarmaHoudini",
			"Karma Houdini",
			"Does terrible things, faces nothing.",
			"where someone gets away with it",
			"LaserGuidedKarma",
		],
		[
			"HoistByHisOwnPetard",
			"Hoist by His Own Petard",
			"Undone by their own trap.",
			"where a schemer falls in their own trap",
		],
		["KarmicDeath", "Karmic Death", "Killed by the very thing they did.", "with a karmic death"],
		["AssholeVictim", "Asshole Victim", "Hard to mourn this one.", "with a victim nobody misses"],
		[
			"NiceJobBreakingItHero",
			"Nice Job Breaking It, Hero",
			"The hero's good deed makes everything worse.",
			"where the hero makes it worse",
		],
		["TemptingFate", "Tempting Fate", "“What could go wrong?” Everything.", "that tempt fate"],
		[
			"MyGodWhatHaveIDone",
			"My God, What Have I Done?",
			"The moment they see what they did.",
			"with a my-god-what-have-I-done moment",
		],
		[
			"TooDumbToLive",
			"Too Dumb to Live",
			"Splits up, goes to the basement, alone.",
			"with someone too dumb to live",
		],
		[
			"DisproportionateRetribution",
			"Disproportionate Retribution",
			"A small slight, an enormous revenge.",
			"with disproportionate revenge",
		],
		["HopeSpot", "Hope Spot", "Things look up. Briefly.", "with a hope spot"],
	],
	romance: [
		[
			"LoveTriangle",
			"Love Triangle",
			"Two suitors, one heart, a lot of glances.",
			"with a love triangle",
		],
		["MeetCute", "Meet Cute", "They meet in the most charming way possible.", "with a meet cute"],
		[
			"LoveAtFirstSight",
			"Love at First Sight",
			"One look, and that's that.",
			"with love at first sight",
			"BelligerentSexualTension",
		],
		[
			"BelligerentSexualTension",
			"Belligerent Sexual Tension",
			"They fight like they're in love. They are.",
			"where they fight like they're in love",
			"LoveAtFirstSight",
		],
		["ShipTease", "Ship Tease", "Hints, and hints, and more hints.", "full of ship teases"],
		[
			"OfficialCouple",
			"Official Couple",
			"The pair the story is built around.",
			"with an official couple",
		],
		[
			"RelationshipUpgrade",
			"Relationship Upgrade",
			"Friends one day, together the next.",
			"with a relationship upgrade",
		],
		[
			"TheOneThatGotAway",
			"The One That Got Away",
			"The love that didn't happen, still haunting.",
			"about the one that got away",
		],
	],
	comedy: [
		["RunningGag", "Running Gag", "Funnier every time it comes back.", "with a running gag"],
		["BrickJoke", "Brick Joke", "A joke from an hour ago finally lands.", "with a brick joke"],
		["LargeHam", "Large Ham", "Every line delivered to the back row.", "with a large ham"],
		[
			"ButtMonkey",
			"Butt-Monkey",
			"Everything bad happens to them, for laughs.",
			"with a butt-monkey",
		],
		[
			"GilliganCut",
			"Gilligan Cut",
			"“I'm not doing that.” Cut to: doing that.",
			"with a Gilligan cut",
		],
		[
			"HypocriticalHumor",
			"Hypocritical Humor",
			"Scolds someone for exactly what they do.",
			"with hypocritical humor",
		],
		[
			"ComicallyMissingThePoint",
			"Comically Missing the Point",
			"Hears everything, understands nothing.",
			"where someone misses the point",
		],
		[
			"NoodleIncident",
			"Noodle Incident",
			"A past disaster, mentioned, never explained.",
			"with a noodle incident",
		],
		[
			"PrecisionFStrike",
			"Precision F-Strike",
			"One perfectly placed swear word.",
			"with a precision F-strike",
		],
		[
			"OverlyLongGag",
			"Overly Long Gag",
			"Keeps going past funny and back into funny.",
			"with an overly long gag",
		],
	],
	action: [
		[
			"BigDamnHeroes",
			"Big Damn Heroes",
			"The cavalry arrives at the last second.",
			"with a last-second rescue",
		],
		[
			"CurbStompBattle",
			"Curb-Stomp Battle",
			"Not a fight. A demolition.",
			"with a one-sided fight",
		],
		["OneManArmy", "One-Man Army", "One person, an army's worth of damage.", "with a one-man army"],
		[
			"TakingYouWithMe",
			"Taking You with Me",
			"If they go down, they're not going alone.",
			"where someone takes the enemy with them",
		],
		[
			"ImprovisedWeapon",
			"Improvised Weapon",
			"Anything can be a weapon.",
			"with improvised weapons",
		],
		[
			"BadassBoast",
			"Badass Boast",
			"Tells you exactly what's coming to you.",
			"with a badass boast",
		],
		[
			"TheWorfEffect",
			"The Worf Effect",
			"The strong one loses, so you know the new threat is stronger.",
			"with the Worf effect",
		],
		["CoolCar", "Cool Car", "The car is a character.", "with a cool car"],
	],
	fright: [
		[
			"JumpScare",
			"Jump Scare",
			"Something leaps out. You jump.",
			"with jump scares",
			"NothingIsScarier",
		],
		[
			"NothingIsScarier",
			"Nothing Is Scarier",
			"What you don't see is the worst part.",
			"where nothing is scarier",
			"JumpScare",
		],
		["FinalGirl", "Final Girl", "The last one standing, and she fights back.", "with a final girl"],
		["BodyHorror", "Body Horror", "The body changes in ways it shouldn't.", "with body horror"],
		[
			"HauntedHouse",
			"Haunted House",
			"The house wants them gone. Or kept.",
			"set in a haunted house",
		],
		[
			"OurVampiresAreDifferent",
			"Our Vampires Are Different",
			"Vampires, with new rules.",
			"with vampires of their own kind",
		],
		[
			"ZombieApocalypse",
			"Zombie Apocalypse",
			"The dead walk and society falls.",
			"set in a zombie apocalypse",
		],
		["AfterTheEnd", "After the End", "The world ended. Life goes on anyway.", "set after the end"],
		[
			"AlienInvasion",
			"Alien Invasion",
			"They came from the sky, and not in peace.",
			"with an alien invasion",
		],
		["TimeTravel", "Time Travel", "Changing the past is never clean.", "with time travel"],
	],
	family: [
		["MamaBear", "Mama Bear", "Threaten her child and see what happens.", "with a mama bear"],
		["PapaWolf", "Papa Wolf", "Touch his kid and you'll regret it.", "with a papa wolf"],
		[
			"ParentalSubstitute",
			"Parental Substitute",
			"Not their parent, raised them anyway.",
			"with a parental substitute",
		],
		[
			"ParentalAbandonment",
			"Parental Abandonment",
			"A parent left, and it shaped everything.",
			"with an absent parent",
		],
		[
			"BigBrotherInstinct",
			"Big Brother Instinct",
			"Protective of a younger sibling, to a fault.",
			"with a protective big brother",
		],
		[
			"HeterosexualLifePartners",
			"Heterosexual Life Partners",
			"Best friends, all but married.",
			"with inseparable best friends",
		],
		[
			"TrueCompanions",
			"True Companions",
			"Not family by blood, family by choice.",
			"with true companions",
		],
		[
			"MentorOccupationalHazard",
			"Mentor Occupational Hazard",
			"Being the mentor is a dangerous job.",
			"where the mentor doesn't make it",
		],
		[
			"AnyoneCanDie",
			"Anyone Can Die",
			"Nobody is safe, not even the lead.",
			"where anyone can die",
		],
	],
	winks: [
		["TitleDrop", "Title Drop", "Someone says the title out loud.", "with a title drop"],
		["ShoutOut", "Shout-Out", "A nod to another story.", "full of shout-outs"],
		["TheCameo", "The Cameo", "A famous face drops by.", "with a cameo"],
		[
			"CreatorCameo",
			"Creator Cameo",
			"The director steps into their own film.",
			"with a creator cameo",
		],
		[
			"ActorAllusion",
			"Actor Allusion",
			"A line that winks at the actor's other roles.",
			"with an actor allusion",
		],
		["CastingGag", "Casting Gag", "The casting itself is the joke.", "with a casting gag"],
		[
			"MeaningfulName",
			"Meaningful Name",
			"The name tells you who they are.",
			"with meaningful names",
		],
		["NoNameGiven", "No Name Given", "We never learn their name.", "where we never learn a name"],
		[
			"BreakingTheFourthWall",
			"Breaking the Fourth Wall",
			"Talks straight to you.",
			"that break the fourth wall",
			"LeaningOnTheFourthWall",
		],
		[
			"LeaningOnTheFourthWall",
			"Leaning on the Fourth Wall",
			"Almost talks to you. Almost.",
			"that lean on the fourth wall",
			"BreakingTheFourthWall",
		],
		[
			"LampshadeHanging",
			"Lampshade Hanging",
			"The story points at its own contrivance.",
			"that hang a lampshade on it",
		],
		[
			"BilingualBonus",
			"Bilingual Bonus",
			"A joke only for those who speak the language.",
			"with a bilingual bonus",
		],
	],
}

/** `ChekhovsGun` → `chekhovs-gun`; `HeroicBSOD` → `heroic-bsod`; `PrecisionFStrike` → `precision-f-strike`. */
export function tropeSlugOf(id: string): string {
	return id
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase()
}

export const TROPES: readonly Trope[] = (Object.keys(RAW) as TropeGroupId[]).flatMap((group) =>
	RAW[group].map(([id, label, line, say, vs]) => ({
		id,
		slug: tropeSlugOf(id),
		label,
		group,
		line,
		say: say ?? `with ${label}`,
		vs,
		spoilersOff: group === "endings" || SPOILERS_OFF.has(id),
	})),
)

export const tropeById = (id: string) => TROPES.find((t) => t.id === id)
export const tropeBySlug = (slug: string) => TROPES.find((t) => t.slug === slug)
export const groupOf = (id: TropeGroupId) => TROPE_GROUPS.find((g) => g.id === id) as TropeGroup
export const tropeUrlOf = (id: string) => `https://tvtropes.org/pmwiki/pmwiki.php/Main/${id}`

/**
 * How an example plays the trope, read from the first words of its write-up ("Subverted: ...", "Averted when ...").
 * "straight" when none is said.
 */
export type Play =
	| "straight"
	| "subverted"
	| "inverted"
	| "averted"
	| "lampshaded"
	| "exaggerated"
	| "downplayed"
	| "played-with"

export const PLAYS: readonly { id: Play; name: string; line: string }[] = [
	{ id: "straight", name: "Played straight", line: "Used as intended." },
	{ id: "subverted", name: "Subverted", line: "Set up, then pulled away." },
	{ id: "inverted", name: "Inverted", line: "Flipped on its head." },
	{ id: "averted", name: "Averted", line: "The moment comes. The trope doesn't." },
	{ id: "lampshaded", name: "Lampshaded", line: "A character points it out." },
	{ id: "exaggerated", name: "Exaggerated", line: "Pushed as far as it goes." },
	{ id: "downplayed", name: "Downplayed", line: "Only a little of it." },
	{ id: "played-with", name: "Played with", line: "Bent, twisted, or both." },
]

const PLAY_WORDS: [RegExp, Play][] = [
	[/^(?:double[- ]?|partially |somewhat |briefly )?subvert/i, "subverted"],
	[/^(?:partially |somewhat )?invert/i, "inverted"],
	[/^(?:partially |somewhat |mostly )?avert/i, "averted"],
	[/^(?:lampshaded|lampshade)/i, "lampshaded"],
	[/^exaggerat/i, "exaggerated"],
	[/^downplay/i, "downplayed"],
	[/^(?:played with|zig[- ]?zag|deconstruct|parodied|discussed|defied|justified)/i, "played-with"],
]

/** How a write-up's opening says it plays the trope. */
export function playOf(text: string): Play {
	const head = text.trim().replace(/^[\s"'“(]+/, "")
	for (const [re, play] of PLAY_WORDS) if (re.test(head)) return play
	return "straight"
}
