// Title puns: a word or phrase in a title (case-insensitive, whole words) plays a fitting effect over its poster.
// Generic motifs only, never a character, sprite or logo.

export interface PunStep {
	/** pixelfx effect id. */
	fx: string
	opts?: Record<string, unknown>
	/** Seconds after the first step. */
	delay?: number
}

export interface Pun {
	/** Phrases matched as whole words in the lowercased title; "=phrase" must be the whole title. */
	words: string[]
	label: string
	steps: PunStep[]
	/** A title that matches it (the tests check each one does). */
	example: string
}

const RED_BOLT = ["#2a0408", "#7a0a14", "#e0202c", "#ff8a7a", "#ffffff"]
const GOLD_BOLT = ["#2a1a04", "#7a5208", "#f0b424", "#fff09a", "#ffffff"]
const ATOMIC = ["#06102a", "#123a8a", "#2a8cff", "#9ae0ff", "#ffffff"]
const FIRE = [
	"#1f0b10",
	"#4a1118",
	"#8c1d1c",
	"#cc3a1a",
	"#f2701f",
	"#ffae35",
	"#ffe27a",
]
const ICY_WATER = ["#081830", "#1f4f94", "#58b4ec", "#d8f4ff", "#ffffff"]
const BIO = ["#04161a", "#0c4a52", "#18b4b0", "#4ce8d8", "#e0fff8"]
const ACID = ["#141a04", "#4a6a08", "#a8d018", "#e8ff5a", "#fbffd8"]
const WHITE_ICE = ["#1a2030", "#5a6a8a", "#b8c8e8", "#eef4ff", "#ffffff"]
const MATRIX = ["#020a04", "#0a3c16", "#1a9a34", "#3cd650", "#e8ffe8"]
const RED_CODE = ["#0a0204", "#3c0a0e", "#9a1a22", "#ff4a3c", "#ffe8e8"]
const SABER_BLUE = ["#04102a", "#1a4ac8", "#4ac8ff", "#c8f4ff", "#ffffff"]
const SILVER = ["#12141c", "#4a5468", "#9aa6ba", "#e0e6f0", "#ffffff"]
const GREEN_SLIME = ["#0a1a06", "#2a6a12", "#5ac81e", "#c8ff6a", "#f4ffd8"]
const GEIGER = ["#06140a", "#1a5a1e", "#4ae04a", "#c8ff8a", "#f4fff0"]
const RED_TRAIL = ["#2a0406", "#8a0a10", "#ff2a2a", "#ff9a8a", "#ffffff"]

/** Specific titles first, then generic words. The first match wins. */
export const PUNS: Pun[] = [
	{
		words: ["jaws"],
		label: "a fin cuts a ripple, then a splash",
		example: "Jaws",
		steps: [{ fx: "cinema/pun-splash", opts: { fin: true } }],
	},
	{
		words: ["=frozen", "frozen ii", "frozen 2"],
		label: "frost nova",
		example: "Frozen",
		steps: [{ fx: "cinema/pun-frost" }],
	},
	{
		words: ["star wars", "jedi"],
		label: "glowing blade slash",
		example: "Star Wars",
		steps: [{ fx: "cinema/pun-blade", opts: { palette: SABER_BLUE } }],
	},
	{
		words: ["harry potter", "wizard"],
		label: "a lightning bolt, then sparkles",
		example: "Harry Potter and the Prisoner of Azkaban",
		steps: [
			{ fx: "cinema/pun-bolt", opts: { palette: GOLD_BOLT } },
			{ fx: "cinema/pun-arcane", delay: 0.35 },
		],
	},
	{
		words: ["ghostbusters"],
		label: "ghosts rise",
		example: "Ghostbusters",
		steps: [{ fx: "cinema/pun-ghosts" }],
	},
	{
		words: ["matrix"],
		label: "green code rain",
		example: "The Matrix",
		steps: [{ fx: "cinema/pun-code", opts: { palette: MATRIX } }],
	},
	{
		words: ["terminator"],
		label: "red code rain",
		example: "The Terminator",
		steps: [{ fx: "cinema/pun-code", opts: { palette: RED_CODE } }],
	},
	{
		words: ["twister", "tornado"],
		label: "a tornado spins up",
		example: "Twister",
		steps: [{ fx: "cinema/pun-tornado" }],
	},
	{
		words: ["godzilla"],
		label: "blue atomic breath",
		example: "Godzilla Minus One",
		steps: [{ fx: "cinema/pun-breath", opts: { palette: ATOMIC } }],
	},
	{
		words: ["back to the future"],
		label: "twin fire trails",
		example: "Back to the Future",
		steps: [{ fx: "cinema/pun-trails" }],
	},
	{
		words: ["mad max", "furiosa", "fast and furious", "furious"],
		label: "fire trails and sand",
		example: "Mad Max: Fury Road",
		steps: [{ fx: "cinema/pun-trails" }, { fx: "cinema/pun-sand", delay: 0.2 }],
	},
	{
		words: ["=up"],
		label: "balloons rise",
		example: "Up",
		steps: [{ fx: "cinema/pun-balloons" }],
	},
	{
		words: ["titanic", "iceberg"],
		label: "icy water and frost",
		example: "Titanic",
		steps: [
			{ fx: "cinema/pun-splash", opts: { palette: ICY_WATER } },
			{ fx: "cinema/pun-frost", delay: 0.3 },
		],
	},
	{
		words: ["dune", "desert", "sahara"],
		label: "drifting sand",
		example: "Dune: Part Two",
		steps: [{ fx: "cinema/pun-sand" }],
	},
	{
		words: ["joker", "casino", "poker", "ace"],
		label: "playing-card confetti",
		example: "Joker",
		steps: [{ fx: "cinema/pun-cards" }],
	},
	{
		words: ["interstellar", "gravity", "black hole", "event horizon"],
		label: "stars swirl into a black hole",
		example: "Interstellar",
		steps: [{ fx: "cinema/pun-vortex" }],
	},
	{
		words: ["stranger things", "upside down"],
		label: "red lightning and drifting spores",
		example: "Stranger Things",
		steps: [
			{ fx: "cinema/pun-bolt", opts: { palette: RED_BOLT } },
			{ fx: "cinema/pun-spores", delay: 0.25 },
		],
	},
	{
		words: ["breaking bad", "crystal", "crystals"],
		label: "blue crystals burst",
		example: "Breaking Bad",
		steps: [{ fx: "cinema/pun-crystals" }],
	},
	{
		words: ["diamond", "diamonds", "uncut gems", "gem", "jewel"],
		label: "white diamonds burst",
		example: "Uncut Gems",
		steps: [{ fx: "cinema/pun-crystals", opts: { palette: WHITE_ICE } }],
	},
	{
		words: ["avatar", "pandora"],
		label: "bioluminescent motes",
		example: "Avatar",
		steps: [
			{ fx: "cinema/pun-spores", opts: { palette: BIO, glow: "#2af0ff" } },
		],
	},
	{
		words: ["spider man", "spider verse", "spider"],
		label: "web strands across a corner",
		example: "Spider-Man: Into the Spider-Verse",
		steps: [{ fx: "cinema/pun-web" }],
	},
	{
		words: [
			"lion king",
			"return of the king",
			"king",
			"kings",
			"queen",
			"kingdom",
			"crown",
			"prince",
			"princess",
			"game of thrones",
			"thrones",
		],
		label: "a crown glints",
		example: "The Lion King",
		steps: [{ fx: "cinema/pun-crown" }],
	},
	{
		words: ["lord of the rings", "the hobbit"],
		label: "a gold glint and fire",
		example: "The Lord of the Rings: The Fellowship of the Ring",
		steps: [
			{ fx: "cinema/pun-crown" },
			{ fx: "cinema/pun-flames", delay: 0.3 },
		],
	},
	{
		words: ["=alien", "=aliens", "alien romulus", "alien covenant"],
		label: "acid ooze drips",
		example: "Alien",
		steps: [{ fx: "cinema/pun-ooze", opts: { palette: ACID } }],
	},
	{
		words: ["oppenheimer", "mission impossible", "bomb", "war", "warfare"],
		label: "an explosion",
		example: "Oppenheimer",
		steps: [{ fx: "cinema/pun-blast" }],
	},
	{
		words: ["finding nemo", "ocean", "sea", "waves", "the abyss", "moana"],
		label: "a splash",
		example: "Finding Nemo",
		steps: [{ fx: "cinema/pun-splash" }],
	},
	{
		words: ["gladiator", "sword", "samurai", "blade runner", "blade"],
		label: "a silver blade slash",
		example: "Gladiator",
		steps: [{ fx: "cinema/pun-blade", opts: { palette: SILVER } }],
	},
	{
		words: ["spirited away", "witch", "witches", "magic", "magician", "spell"],
		label: "a magic circle",
		example: "Spirited Away",
		steps: [{ fx: "cinema/pun-arcane" }],
	},
	{
		words: ["toy story", "inside out"],
		label: "balloons",
		example: "Toy Story",
		steps: [{ fx: "cinema/pun-balloons" }],
	},
	{
		words: ["=coco", "the shining", "halloween"],
		label: "ghosts",
		example: "Coco",
		steps: [{ fx: "cinema/pun-ghosts" }],
	},
	{
		words: ["=psycho"],
		label: "a red slash",
		example: "Psycho",
		steps: [{ fx: "cinema/pun-blade", opts: { palette: RED_BOLT } }],
	},
	// more titles from the catalog
	{
		words: [
			"money heist",
			"squid game",
			"scam 1992",
			"succession",
			"the wolf of wall street",
			"wall street",
			"the big short",
			"heist",
			"millionaire",
			"billions",
			"money",
			"cash",
			"enron",
		],
		label: "banknotes flutter down, coins bounce",
		example: "Money Heist",
		steps: [{ fx: "cinema/pun-cash" }],
	},
	{
		words: [
			"top gun",
			"airplane",
			"plane",
			"planes",
			"flight",
			"pilot",
			"sully",
			"air force one",
		],
		label: "two jets streak up with contrails",
		example: "Top Gun: Maverick",
		steps: [{ fx: "cinema/pun-jets" }],
	},
	{
		words: [
			"=speed",
			"baby driver",
			"=f1",
			"f1 the movie",
			"rush hour",
			"=rush",
			"ford v ferrari",
			"le mans",
			"grand prix",
			"need for speed",
			"fast x",
			"=drive",
			"race",
			"racing",
			"racer",
		],
		label: "speed lines and tire smoke",
		example: "Baby Driver",
		steps: [{ fx: "cinema/pun-speed" }],
	},
	{
		words: [
			"poltergeist",
			"the ring",
			"=ring",
			"paranormal activity",
			"videodrome",
			"static",
			"broadcast",
			"television",
		],
		label: "TV static, then the screen switches off",
		example: "Poltergeist",
		steps: [{ fx: "cinema/pun-static" }],
	},
	{
		words: [
			"rocky",
			"creed",
			"raging bull",
			"the fighter",
			"fight club",
			"million dollar baby",
			"cinderella man",
			"southpaw",
			"boxer",
			"boxing",
			"knockout",
			"punch",
		],
		label: "a comic-book punch impact",
		example: "Rocky III",
		steps: [{ fx: "cinema/pun-punch" }],
	},
	{
		words: [
			"shrek",
			"swamp",
			"bog",
			"marsh",
			"the princess and the frog",
			"frog",
			"where the crawdads sing",
		],
		label: "murky bubbles well up and pop",
		example: "Shrek",
		steps: [{ fx: "cinema/pun-swamp" }],
	},
	{
		words: [
			"the sound of music",
			"whiplash",
			"amadeus",
			"=soul",
			"la la land",
			"the greatest showman",
			"singin in the rain",
			"a star is born",
			"bohemian rhapsody",
			"rocketman",
			"=elvis",
			"encanto",
			"school of rock",
			"=sing",
			"music",
			"musical",
			"symphony",
			"jazz",
			"concert",
		],
		label: "music notes burst and float up",
		example: "The Sound of Music",
		steps: [{ fx: "cinema/pun-notes" }],
	},
	{
		words: [
			"your name",
			"don t look up",
			"armageddon",
			"deep impact",
			"melancholia",
			"comet",
			"meteor",
			"asteroid",
			"shooting star",
		],
		label: "a comet streaks across",
		example: "Your Name.",
		steps: [{ fx: "cinema/pun-comet" }],
	},
	{
		words: [
			"the good the bad and the ugly",
			"for a few dollars more",
			"a fistful of dollars",
			"once upon a time in the west",
			"high noon",
			"shanghai noon",
			"django",
			"unforgiven",
			"true grit",
			"tombstone",
			"westworld",
			"wild west",
			"western",
			"cowboy",
			"cowboys",
			"outlaw",
			"sheriff",
		],
		label: "a tumbleweed bounces through the dust",
		example: "The Good, the Bad and the Ugly",
		steps: [{ fx: "cinema/pun-tumbleweed" }],
	},
	{
		words: [
			"brooklyn nine nine",
			"hot fuzz",
			"the naked gun",
			"end of watch",
			"21 jump street",
			"training day",
			"the wire",
			"bosch",
			"serpico",
			"beverly hills cop",
			"lethal weapon",
			"bad boys",
			"police",
			"cop",
			"cops",
			"patrol",
		],
		label: "red and blue police lights",
		example: "Brooklyn Nine-Nine",
		steps: [{ fx: "cinema/pun-sirens" }],
	},
	{
		words: [
			"ratatouille",
			"the bear",
			"the menu",
			"big night",
			"julie julia",
			"chocolat",
			"chef",
			"kitchen",
			"cook",
			"cooking",
			"coffee",
			"soup",
			"dinner",
			"food",
		],
		label: "curls of steam and a warm glint",
		example: "Ratatouille",
		steps: [{ fx: "cinema/pun-steam" }],
	},
	{
		words: [
			"die hard",
			"=glass",
			"glass onion",
			"unbreakable",
			"black mirror",
			"mirror",
			"shatter",
			"shattered",
			"smash",
		],
		label: "a crack star, then glass shards burst",
		example: "Die Hard",
		steps: [{ fx: "cinema/pun-shatter" }],
	},
	{
		words: [
			"holy grail",
			"grail",
			"life of brian",
			"miracle in cell no 7",
			"miracle",
			"miracles",
			"angel",
			"angels",
			"heaven",
			"heavenly",
			"saint",
			"saints",
			"almighty",
			"the two popes",
			"conclave",
		],
		label: "a beam of light from above, a halo",
		example: "Monty Python and the Holy Grail",
		steps: [{ fx: "cinema/pun-holy" }],
	},
	{
		words: ["chernobyl", "radioactive", "radiation", "nuclear"],
		label: "glowing green motes",
		example: "Chernobyl",
		steps: [
			{ fx: "cinema/pun-spores", opts: { palette: GEIGER, glow: "#6aff5a" } },
		],
	},
	{
		words: [
			"mr robot",
			"hackers",
			"hacker",
			"the social network",
			"the social dilemma",
			"wargames",
			"tron",
			"cyber",
		],
		label: "green code rain",
		example: "Mr. Robot",
		steps: [{ fx: "cinema/pun-code", opts: { palette: MATRIX } }],
	},
	{
		words: ["akira"],
		label: "red light trails",
		example: "Akira",
		steps: [{ fx: "cinema/pun-trails", opts: { palette: RED_TRAIL } }],
	},
	{
		words: ["avengers", "endgame", "justice league", "infinity war"],
		label: "a lightning strike and a blast",
		example: "Avengers: Endgame",
		steps: [
			{ fx: "cinema/pun-bolt", opts: { palette: GOLD_BOLT } },
			{ fx: "cinema/pun-blast", delay: 0.25 },
		],
	},
	{
		words: ["fyre"],
		label: "flames lick up",
		example: "Fyre",
		steps: [{ fx: "cinema/pun-flames" }],
	},
	{
		words: [
			"klaus",
			"=elf",
			"the polar express",
			"home alone",
			"christmas",
			"santa",
			"edward scissorhands",
		],
		label: "a frosty burst",
		example: "Klaus",
		steps: [{ fx: "cinema/pun-frost", opts: { palette: WHITE_ICE } }],
	},
	{
		words: [
			"train to busan",
			"zombieland",
			"28 days later",
			"world war z",
			"the substance",
		],
		label: "green ooze",
		example: "Train to Busan",
		steps: [{ fx: "cinema/pun-ooze", opts: { palette: GREEN_SLIME } }],
	},
	{
		words: [
			"doctor strange",
			"arcane",
			"sorcerer",
			"fantastic beasts",
			"aladdin",
			"genie",
		],
		label: "a magic circle",
		example: "Doctor Strange",
		steps: [{ fx: "cinema/pun-arcane" }],
	},
	{
		words: [
			"ponyo",
			"=luca",
			"lilo stitch",
			"the little mermaid",
			"mermaid",
			"aquaman",
		],
		label: "a splash",
		example: "Ponyo",
		steps: [{ fx: "cinema/pun-splash" }],
	},
	{
		words: ["inception", "tenet", "extra terrestrial", "wall e"],
		label: "stars swirl",
		example: "E.T. the Extra-Terrestrial",
		steps: [{ fx: "cinema/pun-vortex" }],
	},
	// generic words
	{
		words: [
			"fire",
			"flame",
			"flames",
			"burn",
			"burning",
			"inferno",
			"hell",
			"hellboy",
			"blaze",
		],
		label: "flames lick up",
		example: "Fire",
		steps: [{ fx: "cinema/pun-flames" }],
	},
	{
		words: ["ice", "snow", "winter", "frost", "cold", "frozen planet"],
		label: "frost nova",
		example: "Ice Age",
		steps: [{ fx: "cinema/pun-frost" }],
	},
	{
		words: ["storm", "thunder", "lightning", "thor"],
		label: "a lightning strike",
		example: "The Perfect Storm",
		steps: [{ fx: "cinema/pun-bolt" }],
	},
	{
		words: ["ghost", "ghosts", "haunting", "haunted", "phantom", "spirit"],
		label: "ghosts rise",
		example: "Ghost",
		steps: [{ fx: "cinema/pun-ghosts" }],
	},
	{
		words: ["dragon", "dragons", "house of the dragon"],
		label: "fire breath",
		example: "How to Train Your Dragon",
		steps: [{ fx: "cinema/pun-breath", opts: { palette: FIRE } }],
	},
	{
		words: [
			"love",
			"lovers",
			"romance",
			"heart",
			"hearts",
			"valentine",
			"kiss",
		],
		label: "hearts pop",
		example: "Love Actually",
		steps: [{ fx: "cinema/pun-hearts" }],
	},
	{
		words: [
			"space",
			"star",
			"stars",
			"galaxy",
			"cosmos",
			"planet",
			"mars",
			"orbit",
			"odyssey",
		],
		label: "stars swirl",
		example: "Guardians of the Galaxy",
		steps: [{ fx: "cinema/pun-vortex" }],
	},
	{
		words: [
			"zombie",
			"zombies",
			"evil dead",
			"living dead",
			"dawn of the dead",
			"undead",
			"toxic",
			"walking dead",
		],
		label: "green ooze",
		example: "The Walking Dead",
		steps: [{ fx: "cinema/pun-ooze", opts: { palette: GREEN_SLIME } }],
	},
	{
		words: [
			"night",
			"nights",
			"midnight",
			"moon",
			"moonlight",
			"moonrise",
			"dark",
			"darkness",
			"nocturnal",
			"batman",
		],
		label: "a crescent moon and stars",
		example: "Midnight in Paris",
		steps: [{ fx: "cinema/pun-night" }],
	},
	{
		words: ["battle", "soldier", "soldiers", "army", "explosion", "boom"],
		label: "an explosion",
		example: "Saving Private Ryan's battle",
		steps: [{ fx: "cinema/pun-blast" }],
	},
	{
		words: ["wonder", "wonderland", "enchanted", "fantastic", "merlin"],
		label: "a magic circle",
		example: "Alice in Wonderland",
		steps: [{ fx: "cinema/pun-arcane" }],
	},
	{
		words: ["water", "river", "rain", "flood", "shark", "sharks"],
		label: "a splash",
		example: "The Shape of Water",
		steps: [{ fx: "cinema/pun-splash" }],
	},
	{
		words: ["party", "birthday", "balloon", "balloons", "celebration"],
		label: "balloons",
		example: "Birthday Party",
		steps: [{ fx: "cinema/pun-balloons" }],
	},
	{
		words: ["card", "cards", "gamble", "gambler", "vegas"],
		label: "playing cards",
		example: "House of Cards",
		steps: [{ fx: "cinema/pun-cards" }],
	},
]

const norm = (s: string) =>
	` ${s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.replace(/['’]s\b/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()} `

const compiled = PUNS.map((p) => ({
	pun: p,
	words: p.words.map((w) => ({
		exact: w.startsWith("="),
		text: norm(w.replace(/^=/, "")),
	})),
}))

/** The pun for a title, or null. */
export function matchPun(title: string): Pun | null {
	if (!title) return null
	const t = norm(title)
	for (const c of compiled)
		if (c.words.some((w) => (w.exact ? t === w.text : t.includes(w.text))))
			return c.pun
	return null
}
