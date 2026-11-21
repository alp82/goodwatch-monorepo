import type { Deck } from "./types.ts"

// Keyed by the decade's name ("1990s"). What each decade was about, in ideas and themes; television has its own
// history, so every decade has a text per kind.
export const DECADES: Deck = {
	"1930s": {
		movies: {
			short: "Sound arrives, and Hollywood finds its voice.",
			lede: "The movies had only just learned to talk, and they made the most of it: fast-talking comedies, gangsters, monsters, and musicals that waved the Depression away for an evening. Studios ran like factories and somehow turned out magic. Much of what we call classic Hollywood starts here.",
		},
		shows: {
			short: "Before television: only a few experiments.",
			lede: "Television was a laboratory curiosity, with a handful of experimental broadcasts and almost nobody watching. What survives from these years is rare. Think of it as the prologue.",
		},
		all: {
			short: "Sound arrives, and Hollywood finds its voice.",
			lede: "The movies had only just learned to talk, and they made the most of it: fast-talking comedies, gangsters, monsters, and musicals that waved the Depression away for an evening. Studios ran like factories and somehow turned out magic. Television was still a laboratory experiment, so this decade belongs to the big screen.",
		},
	},
	"1940s": {
		movies: {
			short: "War, shadows, and the birth of film noir.",
			lede: "A decade split by the war. First came morale boosters and romances with real goodbyes, then the shadows moved in: detectives, double-crosses, and endings that didn't promise much. The dialogue has never been sharper.",
		},
		shows: {
			short: "Television flickers on after the war.",
			lede: "After the war, sets began arriving in living rooms and broadcasters worked out what to do with them. Variety hours, live plays, puppets, and news read straight to camera. Much of it went out live and was never recorded.",
		},
		all: {
			short: "War, shadows, and the birth of film noir.",
			lede: "A decade split by the war. First came morale boosters and romances with real goodbyes, then the shadows moved in: detectives, double-crosses, and endings that didn't promise much. By the end, the first television sets were flickering on in living rooms.",
		},
	},
	"1950s": {
		movies: {
			short: "Widescreen, color, and the first teen rebels.",
			lede: "Television was stealing the audience, so movies went bigger: wide screens, bold color, epics with enormous casts. Meanwhile directors in Japan, Italy, and Sweden were making some of the best films anywhere, and teenagers got their first screen rebels. Fear of bombs and flying saucers ran underneath it all.",
		},
		shows: {
			short: "Live broadcasts and the first great sitcoms.",
			lede: "The first golden age. Families gathered around one small screen for variety shows, westerns, live drama, and sitcoms that set a template everyone still uses. Black and white, a little stiff, and full of invention.",
		},
		all: {
			short: "Widescreen epics, and TV's first golden age.",
			lede: "Television moved into the living room with live drama, westerns, and sitcoms that set a template everyone still uses. Movies answered by going bigger: wide screens, bold color, enormous casts, while directors in Japan, Italy, and Sweden made some of the best films anywhere. Fear of bombs and flying saucers ran underneath it all.",
		},
	},
	"1960s": {
		movies: {
			short: "The old rules break, everywhere at once.",
			lede: "The studio system cracked and something wilder came through. New waves in France and beyond, spies and spaghetti westerns, and by the end of the decade, movies with sex, violence, and endings nobody had allowed before. It still feels like a door being kicked open.",
		},
		shows: {
			short: "Color arrives, with spies and starships.",
			lede: "Television turned to color and got playful: spies, witches, castaways, and a starship crew going where no one had gone before. Anthologies told eerie stories with a twist, and Britain sent over its own odd treasures. Comfort viewing with a strange streak.",
		},
		all: {
			short: "The old rules break, everywhere at once.",
			lede: "The studio system cracked and something wilder came through: new waves, spies, spaghetti westerns, and movies with endings nobody had allowed before. Television turned to color and got playful, with witches, castaways, and a starship crew going where no one had gone. It still feels like a door being kicked open.",
		},
	},
	"1970s": {
		movies: {
			short: "Directors take over, and it shows.",
			lede: "For a few years the filmmakers ran the show, and they made movies about antiheroes, corruption, and a country that had stopped trusting itself. Gritty streets, long takes, moral mess. Then a shark and a galaxy far away invented the blockbuster.",
		},
		shows: {
			short: "Sitcoms get honest and cops hit the streets.",
			lede: "Sitcoms started talking about real life: politics, work, money, and everything families argue about. Detectives in rumpled coats solved a case a week, and the miniseries became an event whole countries watched together. Variety and sketch comedy were at their peak.",
		},
		all: {
			short: "Directors take over, and sitcoms get honest.",
			lede: "For a few years the filmmakers ran the show, and they made movies about antiheroes, corruption, and a country that had stopped trusting itself. On television, sitcoms started talking about real life and rumpled detectives solved a case a week. Then a shark and a galaxy far away invented the blockbuster.",
		},
	},
	"1980s": {
		movies: {
			short: "Blockbusters, synths, and movies you can quote.",
			lede: "The blockbuster became a way of life: adventurers, time machines, action heroes with one-liners. Teen comedies and slashers filled the multiplex, and the video store let you take it all home. Big hair, bigger soundtracks, and a lot of heart.",
		},
		shows: {
			short: "Glossy soaps, ensemble dramas, cozy sitcoms.",
			lede: "Prime-time soaps brought shoulder pads and cliffhangers, while police and hospital dramas learned to juggle a dozen characters at once. Sitcoms were warm, familiar, and everywhere. Cable and the remote control started giving viewers a choice.",
		},
		all: {
			short: "Blockbusters, synths, and stories you can quote.",
			lede: "The blockbuster became a way of life: adventurers, time machines, action heroes with one-liners. At home, sitcoms were warm and everywhere, prime-time soaps brought shoulder pads and cliffhangers, and the video store let you take the movies with you. Big hair, bigger soundtracks, and a lot of heart.",
		},
	},
	"1990s": {
		movies: {
			short: "Indie cool meets the first digital dinosaurs.",
			lede: "Independent film crashed the mainstream with talky crooks, slackers, and stories told out of order. At the same time computers started putting impossible things on screen, from dinosaurs to sinking ships. A great decade for thrillers, romantic comedies, and animation.",
		},
		shows: {
			short: "Friends on a couch and the truth out there.",
			lede: "Must-see sitcoms about friends and nothing in particular, plus dramas that got stranger and smarter: small towns with secrets, agents chasing aliens, a vampire slayer in high school. Animation for adults broke through. By the end, cable was getting ready to change everything.",
		},
		all: {
			short: "Indie cool, digital dinosaurs, friends on a couch.",
			lede: "Independent film crashed the mainstream with talky crooks and stories told out of order, while computers started putting impossible things on screen. Television had sitcoms about nothing in particular and dramas that got stranger and smarter: small towns with secrets, agents chasing aliens. A great decade to get lost in.",
		},
	},
	"2000s": {
		movies: {
			short: "Fantasy epics, superheroes, and darker reboots.",
			lede: "Wizards and hobbits proved you could film the unfilmable, and superheroes began their takeover. Franchises went darker and more serious, comedies got looser and ruder, and world cinema found a wider audience than ever. The DVD shelf was king.",
		},
		shows: {
			short: "Antiheroes arrive and TV starts to feel like film.",
			lede: "Cable dramas made the antihero a star: mobsters in therapy, corrupt cops, a chemistry teacher making bad choices. Shows became novels you watched, and box sets made the binge possible. Reality TV took over everything else.",
		},
		all: {
			short: "Fantasy epics, superheroes, and the TV antihero.",
			lede: "Wizards and hobbits proved you could film the unfilmable, and superheroes began their takeover. On cable, the antihero became a star: mobsters in therapy, corrupt cops, a chemistry teacher making bad choices. Shows became novels you watched, and the box set made the binge possible.",
		},
	},
	"2010s": {
		movies: {
			short: "Shared universes and a boom in bold small films.",
			lede: "Shared universes ruled the box office, with every hero connected to every other. Away from the capes, smaller studios backed strange and personal movies, horror got smart, and a Korean thriller won Best Picture. Streaming started changing where movies live.",
		},
		shows: {
			short: "Peak TV: more great shows than hours to watch.",
			lede: "Streaming arrived and the floodgates opened. Dragons and thrones became a worldwide habit, whole seasons dropped at once, and comedies got shorter, sadder, and better. Great series started coming from everywhere, not only Hollywood.",
		},
		all: {
			short: "Shared universes, peak TV, and streaming for all.",
			lede: "Shared universes ruled the box office while smaller studios backed strange and personal movies. Streaming opened the floodgates on television: dragons and thrones became a worldwide habit and whole seasons dropped at once. There was suddenly more to watch than hours to watch it.",
		},
	},
	"2020s": {
		movies: {
			short: "Streaming premieres and the big screen fights back.",
			lede: "Theaters went dark, movies moved to the living room, and then audiences came back for the ones that felt like events. Long runtimes, big swings, and stories from everywhere are part of the mix. Still being written.",
		},
		shows: {
			short: "Global hits and the return of the weekly wait.",
			lede: "Hits now come from anywhere: Korea, Spain, Britain, Japan. Limited series tell one story and stop, and the weekly episode made a comeback after years of bingeing. There is more to watch than ever, which is its own problem.",
		},
		all: {
			short: "Stories from everywhere, on every screen.",
			lede: "Theaters went dark, movies moved to the living room, and then audiences came back for the ones that felt like events. Series hits now come from anywhere: Korea, Spain, Britain, Japan, and the weekly episode made a comeback. Still being written.",
		},
	},
}
