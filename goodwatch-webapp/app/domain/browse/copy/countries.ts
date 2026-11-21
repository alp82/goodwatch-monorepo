import type { Deck } from "./types.ts"

// Keyed by ISO 3166-1 alpha-2 code, lowercase. What a country's movies and shows are known for: traditions and
// tendencies that stay true, with a famous name only where it makes the point.
export const COUNTRIES: Deck = {
	us: {
		movies: {
			short: "Hollywood, and everything outside it.",
			lede: "The country that turned movies into the world's favorite night out. Hollywood supplies the blockbusters, but there's just as much life in the indies, the horror, and the comedies. Whatever you're in the mood for, America has made plenty of it.",
		},
		shows: {
			short: "Sitcoms, prestige drama, and everything else.",
			lede: "The home of the sitcom, the cable antihero, and the streaming binge. American TV sets the pace for much of the world, with more genres and bigger budgets than anywhere else. The hard part is choosing.",
		},
		all: {
			short: "Hollywood, prestige TV, and everything outside them.",
			lede: "The country that turned movies into the world's favorite night out and the sitcom into a nightly habit. Hollywood supplies the blockbusters, cable and streaming supply the antiheroes, and there's just as much life in the indies, the horror, and the comedies. The hard part is choosing.",
		},
	},
	gb: {
		movies: {
			short: "Dry wit, period drama, and kitchen-sink grit.",
			lede: "British films swing between elegant costume dramas, tough working-class stories, and comedies so dry you could miss the joke. Spies and wizards come from here too. Expect great actors, sharp writing, and probably some rain.",
		},
		shows: {
			short: "Short seasons, sharp writing, superb detectives.",
			lede: "British TV keeps it short: a handful of episodes, tightly written, and then it's over. Murder mysteries in pretty villages, bleak crime, painfully funny comedy, and lavish period drama. Nobody does a detective better.",
		},
		all: {
			short: "Dry wit, period drama, and superb detectives.",
			lede: "British stories swing between elegant costume dramas, tough working-class tales, and comedies so dry you could miss the joke. The films give you spies and wizards; the series keep it short, tightly written, and usually involve a murder in a pretty village. Expect great actors, sharp writing, and probably some rain.",
		},
	},
	fr: {
		movies: {
			short: "Romance, style, and a taste for argument.",
			lede: "The country where cinema was born has never stopped caring about it. French films talk, flirt, philosophize, and break rules, from the New Wave to today's thrillers and comedies. Their love stories feel like real life, complications included.",
		},
		shows: {
			short: "Stylish thrillers and smart, talky comedies.",
			lede: "French series have found a worldwide audience with slick heist stories, spy dramas, and comedies set in the film business. The writing is quick and the settings are easy on the eyes. A good way to keep your French up.",
		},
		all: {
			short: "Romance, style, and a taste for argument.",
			lede: "The country where cinema was born has never stopped caring about it. French stories talk, flirt, philosophize, and break rules, from the New Wave to today's slick heist series and spy dramas. Their love stories feel like real life, complications included.",
		},
	},
	de: {
		movies: {
			short: "History faced head-on, and bold storytelling.",
			lede: "German cinema runs from silent-era nightmares that shaped horror for good to unflinching films about the country's own past. There are tense thrillers, quiet dramas, and the odd offbeat comedy. Serious, yes, but never dull.",
		},
		shows: {
			short: "Dark mysteries and gripping historical drama.",
			lede: "German series have a gift for the dark and intricate: time-bending mysteries, Cold War spy stories, crime in the Weimar years. They're carefully built and ask for your full attention. Worth every subtitle.",
		},
		all: {
			short: "History faced head-on, and dark, intricate mysteries.",
			lede: "German storytelling runs from silent-era nightmares that shaped horror for good to unflinching looks at the country's own past. Its series have a gift for the dark and intricate: time-bending mysteries, Cold War spies, crime in the Weimar years. Serious, yes, but never dull.",
		},
	},
	it: {
		movies: {
			short: "Neorealism, grand passions, and stylish scares.",
			lede: "Italy gave the world neorealism, Fellini's dreamlike epics, westerns shot in the dust, and horror in screaming color. Its films love big feelings, beautiful faces, and long lunches. Even the sad ones are gorgeous.",
		},
		shows: {
			short: "Crime sagas and sun-soaked family drama.",
			lede: "Italian series are best known for crime: sprawling stories of clans, cops, and cities under pressure. Alongside them you'll find literary adaptations and family dramas with real warmth. Expect passion at every volume.",
		},
		all: {
			short: "Grand passions, crime sagas, and stylish scares.",
			lede: "Italy gave the world neorealism, Fellini's dreamlike epics, westerns shot in the dust, and horror in screaming color. Its series are best known for crime: sprawling stories of clans, cops, and cities under pressure. Expect big feelings at every volume, and even the sad ones are gorgeous.",
		},
	},
	es: {
		movies: {
			short: "Bold color, dark fairy tales, and big feelings.",
			lede: "Spanish cinema runs hot: melodramas in bold color, twisty thrillers, and horror that owes as much to fairy tales as to fear. Pedro Almodóvar is the famous name, but the bench is deep. Rarely subtle, always alive.",
		},
		shows: {
			short: "Addictive thrillers with twists to spare.",
			lede: "Spanish series became a worldwide habit with heists, elite schools, and thrillers that end every episode on a hook. They're fast, emotional, and built for bingeing. Start one on a Friday.",
		},
		all: {
			short: "Bold color, dark fairy tales, and twists to spare.",
			lede: "Spanish storytelling runs hot: melodramas in bold color, horror that owes as much to fairy tales as to fear, and thrillers that end every hour on a hook. Pedro Almodóvar is the famous name on the big screen; heists and elite schools made the series a worldwide habit. Rarely subtle, always alive.",
		},
	},
	jp: {
		movies: {
			short: "Samurai, spirits, anime, and quiet family drama.",
			lede: "Few countries have given cinema more. Samurai epics, giant monsters, ghost stories that changed horror, hand-drawn worlds from Studio Ghibli, and gentle dramas about ordinary families. Start anywhere and you'll find something you've never seen done that way.",
		},
		shows: {
			short: "Anime above all, plus quietly great dramas.",
			lede: "Japan is the home of anime, from adventures that run for decades to short, strange, beautiful series. Its live-action shows are worth a look as well, often small in scale and big in feeling. Fair warning: the opening themes get stuck in your head.",
		},
		all: {
			short: "Samurai, spirits, anime, and quiet family drama.",
			lede: "Few countries have given the screen more. Samurai epics, giant monsters, ghost stories that changed horror, hand-drawn worlds from Studio Ghibli, and anime adventures that run for decades. Start anywhere and you'll find something you've never seen done that way.",
		},
	},
	kr: {
		movies: {
			short: "Genre thrills with a sharp social edge.",
			lede: "Korean cinema mixes genres like nobody else: a thriller turns funny, a comedy turns brutal, a monster movie turns out to be about family. Revenge, class, and dark humor run through the best of it. Go in knowing as little as possible.",
		},
		shows: {
			short: "K-dramas: romance, revenge, and cliffhangers.",
			lede: "K-dramas tell a full story in one season and make you feel all of it. Sweeping romances, revenge plots, survival games, and zombies in period costume. One episode in, you'll understand the devotion.",
		},
		all: {
			short: "Genre thrills, sweeping romance, sharp social edge.",
			lede: "Korean stories mix genres like nobody else: a thriller turns funny, a comedy turns brutal, a romance breaks your heart in one season flat. Revenge, class, and dark humor run through the best of it. Go in knowing as little as possible.",
		},
	},
	cn: {
		movies: {
			short: "Sweeping epics, martial arts, and intimate drama.",
			lede: "Chinese cinema ranges from lavish historical epics and martial arts in flowing silk to quiet films about ordinary lives in a changing country. The scale can be enormous and the images stunning. A deep well if you're willing to explore.",
		},
		shows: {
			short: "Costume epics and long, devoted romances.",
			lede: "Chinese series are famous for costume dramas: palace intrigue, sword-wielding heroes, and romances that stretch across lifetimes. They run long and reward commitment. Modern workplace and family stories have a big following too.",
		},
		all: {
			short: "Sweeping epics, martial arts, and devoted romances.",
			lede: "Chinese storytelling ranges from lavish historical epics and martial arts in flowing silk to quiet stories about ordinary lives in a changing country. The series are famous for palace intrigue and romances that stretch across lifetimes. The scale can be enormous, and it rewards commitment.",
		},
	},
	hk: {
		movies: {
			short: "Kung fu, gunfights, and neon-lit longing.",
			lede: "For a small place, Hong Kong changed action movies for good. Kung fu legends, balletic gunfights, wild comedies, and moody romances drenched in neon. Fast, inventive, and endlessly cool.",
		},
		shows: {
			short: "Fast-talking dramas from a city that never stops.",
			lede: "Hong Kong television is built on long-running family sagas, cop shows, and period martial arts adventures. They move quickly and wear their hearts on their sleeves. A window into the city's humor and pace.",
		},
		all: {
			short: "Kung fu, gunfights, and neon-lit longing.",
			lede: "For a small place, Hong Kong changed action for good. Kung fu legends, balletic gunfights, wild comedies, and moody romances drenched in neon. Fast, inventive, and endlessly cool.",
		},
	},
	in: {
		movies: {
			short: "Songs, spectacle, and stories with everything.",
			lede: "Indian cinema is many industries in many languages, from Hindi blockbusters to Tamil and Telugu epics and thoughtful Bengali and Malayalam dramas. A single movie can hold romance, action, comedy, and a few songs. Clear the evening: they run long and earn it.",
		},
		shows: {
			short: "Crime, family, and big-city ambition.",
			lede: "Streaming gave Indian series room to get gritty: gangster sagas, police procedurals, and sharp stories about family and ambition. They come in many languages and many moods. Start with the crime dramas, they're the standouts.",
		},
		all: {
			short: "Songs, spectacle, and stories with everything.",
			lede: "Indian storytelling is many industries in many languages, from Hindi blockbusters to Tamil and Telugu epics and thoughtful Bengali and Malayalam dramas. A single movie can hold romance, action, comedy, and a few songs, and streaming gave the series room to get gritty. Clear the evening: they run long and earn it.",
		},
	},
	ca: {
		movies: {
			short: "Offbeat indies and unsettling originals.",
			lede: "Canadian films often work at a slight angle to Hollywood: thoughtful dramas, dry comedies, and some of the strangest horror ever made. Quebec adds a rich French-language cinema of its own. Quietly excellent, as you'd expect.",
		},
		shows: {
			short: "Warm comedies and smart genre shows.",
			lede: "Canadian TV does kindness well, with comedies about small towns and odd families that became comfort viewing everywhere. It also turns out clever science fiction and solid crime shows. Polite, funny, and better than it lets on.",
		},
		all: {
			short: "Offbeat indies, warm comedies, strange horror.",
			lede: "Canadian stories often work at a slight angle to Hollywood: thoughtful dramas, some of the strangest horror ever made, and comedies about small towns and odd families that became comfort viewing everywhere. Quebec adds a rich French-language tradition of its own. Polite, funny, and better than it lets on.",
		},
	},
	au: {
		movies: {
			short: "Outback epics and gloriously odd comedies.",
			lede: "Australian movies make the most of the land: wide deserts, wild roads, and danger a long way from help. There's a strong streak of scrappy comedy and tough crime as well. Big skies, dry humor.",
		},
		shows: {
			short: "Sunny soaps, sharp comedy, gritty crime.",
			lede: "Long-running soaps, crime dramas with real bite, and comedies that don't mind being awkward. Australian TV is unpretentious and often very funny. Its kids' shows are some of the best anywhere.",
		},
		all: {
			short: "Outback epics, dry humor, and gritty crime.",
			lede: "Australian stories make the most of the land: wide deserts, wild roads, and danger a long way from help. There's a strong streak of scrappy comedy and crime with real bite, and its kids' shows are some of the best anywhere. Big skies, dry humor.",
		},
	},
	mx: {
		movies: {
			short: "Magic, grit, and directors the world borrowed.",
			lede: "Mexico's golden age gave Latin America its movie stars, and its modern directors went on to win over the world. At home the films mix raw street-level drama with fantasy and dark humor. Full of life, even when the subject is death.",
		},
		shows: {
			short: "Telenovelas, and a new wave of crime drama.",
			lede: "The telenovela is Mexico's great export: love, betrayal, and secrets told nightly with total commitment. Recent years added crime sagas and stylish dramas made for streaming. Passion is the common thread.",
		},
		all: {
			short: "Telenovelas, street-level drama, dark humor.",
			lede: "Mexico's golden age gave Latin America its movie stars, its modern directors went on to win over the world, and the telenovela became its great export. The stories mix raw street-level drama with fantasy, dark humor, and total commitment to love and betrayal. Full of life, even when the subject is death.",
		},
	},
	br: {
		movies: {
			short: "Energy, rhythm, and stories from the streets.",
			lede: "Brazilian cinema is vivid and urgent, from stories of life in the favelas to road movies across a huge country. It can be joyful and brutal in the same film. Music is never far away.",
		},
		shows: {
			short: "The telenovela, perfected, and bold new dramas.",
			lede: "Brazil's telenovelas are a national event, with huge casts and plots everyone talks about. Newer series made for streaming take on crime, science fiction, and city life. Big emotions, big audiences.",
		},
		all: {
			short: "Vivid, urgent, and never far from music.",
			lede: "Brazilian storytelling is vivid and urgent, from life in the favelas to road trips across a huge country and telenovelas the whole nation talks about. It can be joyful and brutal in the same hour. Music is never far away.",
		},
	},
	ar: {
		movies: {
			short: "Wry, humane, and hard to predict.",
			lede: "Argentine films are witty and humane, with a talent for thrillers that turn on a single buried secret. Dark comedy and political memory run through many of them. A great pick when you want a story that respects you.",
		},
		shows: {
			short: "Sharp-witted dramas with a dark sense of humor.",
			lede: "Argentine series bring the same wit as the country's films: clever crime stories, tangled families, and comedy with a bitter edge. Smaller in number, strong in writing. Worth seeking out.",
		},
		all: {
			short: "Wit, buried secrets, and a bitter edge.",
			lede: "Argentine stories are witty and humane, with a talent for thrillers that turn on a single buried secret. Dark comedy and political memory run through many of them. A great pick when you want a story that respects you.",
		},
	},
	se: {
		movies: {
			short: "Bergman's shadows and Nordic chill.",
			lede: "Swedish cinema will always be tied to Ingmar Bergman and his questions about faith, death, and marriage. Around him you'll find cold-blooded thrillers, deadpan comedies, and warm films about childhood. Cool on the surface, intense underneath.",
		},
		shows: {
			short: "Nordic noir at its coldest and best.",
			lede: "Sweden helped start the Nordic noir wave: gloomy detectives, long winters, and murders that reveal something rotten in a tidy society. Slow, moody, and very hard to turn off. Bring a sweater.",
		},
		all: {
			short: "Bergman, Nordic noir, and long winters.",
			lede: "Sweden will always be tied to Ingmar Bergman and his questions about faith, death, and marriage, and to the gloomy detectives who started the Nordic noir wave. Around them you'll find deadpan comedies and warm stories about childhood. Cool on the surface, intense underneath.",
		},
	},
	dk: {
		movies: {
			short: "Raw drama and rules made to be broken.",
			lede: "Danish films punch well above the country's size. The Dogme movement stripped moviemaking to its bones, and its directors kept making fierce, uncomfortable, darkly funny drama. Expect dinner parties that go very wrong.",
		},
		shows: {
			short: "Political drama and classic Nordic noir.",
			lede: "Danish television gave the world some of its favorite crime series and one of the great political dramas. The pace is patient, the characters are complicated, and the knitwear is famous. Smart television for grown-ups.",
		},
		all: {
			short: "Fierce drama, great crime, famous knitwear.",
			lede: "Danish stories punch well above the country's size: fierce, uncomfortable, darkly funny films, some of the world's favorite crime series, and one of the great political dramas. The pace is patient and the characters are complicated. Expect dinner parties that go very wrong.",
		},
	},
	ie: {
		movies: {
			short: "Dark humor, big hearts, and bad weather.",
			lede: "Irish films have a way of being funny and sad in the same breath. Small towns, old grudges, music in the pub, and people who say the opposite of what they feel. The landscape does a lot of the talking.",
		},
		shows: {
			short: "Comedy with bite and stories of home.",
			lede: "Irish series are few in number and full of character: dark comedies about family, tender love stories, and crime with a local accent. The dialogue is the star. You'll be quoting it.",
		},
		all: {
			short: "Funny and sad in the same breath.",
			lede: "Irish stories have a way of being funny and sad in the same breath. Small towns, old grudges, music in the pub, and people who say the opposite of what they feel. The dialogue is the star, and the landscape does the rest of the talking.",
		},
	},
	be: {
		movies: {
			short: "Quiet realism and a streak of the surreal.",
			lede: "Belgian cinema is known for unshowy, deeply humane films about people on the edge of getting by. It also has a surreal, darkly comic side all its own. Small films that stay with you.",
		},
		shows: {
			short: "Offbeat crime and dark, clever drama.",
			lede: "Belgian series have earned a following for crime stories with odd angles and a dry sense of humor. They're inventive on small budgets. A good tip for when you've run out of Scandinavian noir.",
		},
		all: {
			short: "Humane, surreal, and dryly funny.",
			lede: "Belgian storytelling is known for unshowy, deeply humane films about people on the edge of getting by, and for crime series with odd angles. It also has a surreal, darkly comic side all its own. Small stories that stay with you.",
		},
	},
	nl: {
		movies: {
			short: "Blunt, bold, and unafraid to provoke.",
			lede: "Dutch films tend to say what they mean. Expect frank dramas, wartime stories told without sentiment, and thrillers with a nasty streak. Direct, unsentimental, and often surprising.",
		},
		shows: {
			short: "Down-to-earth dramas and crime close to home.",
			lede: "Dutch series favor realism: crime in ordinary suburbs, families under strain, and humor as dry as it comes. Unpolished in a good way. Worth a try if you like your drama grounded.",
		},
		all: {
			short: "Frank, grounded, and unsentimental.",
			lede: "Dutch stories tend to say what they mean. Expect frank dramas, wartime tales told without sentiment, crime in ordinary suburbs, and humor as dry as it comes. Direct, unpolished in a good way, and often surprising.",
		},
	},
	pl: {
		movies: {
			short: "Moral weight, history, and striking images.",
			lede: "Polish cinema has a long tradition of serious, searching films, shaped by war and decades of censorship. Directors like Kieślowski and Wajda made moral questions feel urgent. Demanding and beautiful.",
		},
		shows: {
			short: "Gritty crime and stories from recent history.",
			lede: "Polish series lean toward crime and history: detectives in gray cities, mysteries rooted in the past, and the occasional fantasy. Moody and well made. A growing shelf worth watching.",
		},
		all: {
			short: "Serious, searching, and beautifully made.",
			lede: "Polish storytelling has a long tradition of serious, searching work, shaped by war and decades of censorship. Directors like Kieślowski and Wajda made moral questions feel urgent, and today's series add detectives in gray cities and mysteries rooted in the past. Demanding and beautiful.",
		},
	},
	ru: {
		movies: {
			short: "Vast landscapes and long, searching looks.",
			lede: "Russian cinema thinks big: revolutions, wars, and the soul itself. From the pioneers of film editing to the slow, hypnotic films of Tarkovsky, it has shaped how movies are made. Patience is rewarded.",
		},
		shows: {
			short: "Literary adaptations and hard-edged drama.",
			lede: "Russian series often draw on the country's great novels and turbulent history. Expect period drama on a grand scale along with tough crime stories. Long, serious, and absorbing.",
		},
		all: {
			short: "Great novels, big history, and patience rewarded.",
			lede: "Russian storytelling thinks big: revolutions, wars, and the soul itself. From the pioneers of film editing to the slow, hypnotic films of Tarkovsky and period series drawn from the great novels, it asks for your time. Patience is rewarded.",
		},
	},
	tr: {
		movies: {
			short: "Slow, thoughtful dramas and crowd-pleasers.",
			lede: "Turkish cinema has two faces: patient, beautifully shot dramas that win prizes at festivals, and big-hearted popular films full of laughter and tears. Both care deeply about family and belonging. Take your time with them.",
		},
		shows: {
			short: "Epic romances the whole world got hooked on.",
			lede: "Turkish dramas are a worldwide phenomenon: long episodes, forbidden love, family feuds, and Ottoman palaces. They take their time and wring every emotion out of a scene. Once you're in, you're in for the season.",
		},
		all: {
			short: "Big-hearted films and dramas the world binges.",
			lede: "Turkish storytelling has two faces: patient, beautifully shot films that win prizes at festivals, and big-hearted dramas with forbidden love, family feuds, and Ottoman palaces that half the world watches. Both care deeply about family and belonging. Once you're in, you're in for the season.",
		},
	},
	no: {
		movies: {
			short: "Fjords, dry humor, and nature's fury.",
			lede: "Norwegian films make great use of the landscape, with disaster movies, wartime stories, and trolls straight out of folklore. A dry, deadpan humor runs through even the tense ones. Cold air, warm heart.",
		},
		shows: {
			short: "Honest teen drama and crime in the far north.",
			lede: "Norwegian series range from teen drama that felt startlingly real to political thrillers and crime under the midnight sun. Understated and sharp. Easy to underestimate, hard to forget.",
		},
		all: {
			short: "Cold air, warm heart, deadpan humor.",
			lede: "Norwegian stories make great use of the landscape, with disaster movies, wartime tales, trolls straight out of folklore, and a teen series that felt startlingly real. A dry, deadpan humor runs through even the tense ones. Easy to underestimate, hard to forget.",
		},
	},
	nz: {
		short: "Epic scenery and a humor all its own.",
		lede: "New Zealand punches far above its size, with landscapes made for fantasy epics and a deadpan comedy style nobody else has. Warm, odd, and often surprisingly moving.",
	},
	tw: {
		short: "Tender, patient, and beautifully observed.",
		lede: "Taiwan is known for patient, beautifully observed stories about families, cities, and growing up, along with heartfelt youth romances. Quiet on the surface, with a lot going on underneath.",
	},
	ir: {
		short: "Simple stories that open onto big questions.",
		lede: "Iranian filmmakers are masters of doing a lot with a little. A lost notebook or a family dispute becomes a story about truth, class, and conscience. Humane, clever, and gripping in a quiet way.",
	},
	th: {
		short: "Ghost stories, fighters, and gentle dreams.",
		lede: "Thailand is loved for hair-raising ghost stories, bone-crunching martial arts, and dreamlike dramas unlike anything else. Its tearjerkers and teen romances travel well too.",
	},
}

/** English names as they appear in addresses, to codes. */
export const COUNTRY_ALIASES: Record<string, string> = {
	"united-states": "us",
	usa: "us",
	"united-kingdom": "gb",
	uk: "gb",
	france: "fr",
	germany: "de",
	italy: "it",
	spain: "es",
	japan: "jp",
	"south-korea": "kr",
	korea: "kr",
	china: "cn",
	"hong-kong": "hk",
	"hong-kong-sar-china": "hk",
	india: "in",
	canada: "ca",
	australia: "au",
	mexico: "mx",
	brazil: "br",
	argentina: "ar",
	sweden: "se",
	denmark: "dk",
	ireland: "ie",
	belgium: "be",
	netherlands: "nl",
	poland: "pl",
	russia: "ru",
	turkiye: "tr",
	"t-rkiye": "tr",
	turkey: "tr",
	norway: "no",
	"new-zealand": "nz",
	taiwan: "tw",
	iran: "ir",
	thailand: "th",
}
