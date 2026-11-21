import type { Deck } from "./types.ts"

// Themes: what a story is about. Keyed by the theme ids of domain/themes-styles.ts. Written without naming the kind
// wherever the same sentence is true of movies and shows.
export const THEMES: Deck = {
	crime: {
		short: "Lawbreakers, and the people chasing them.",
		lede: "Stories set on the wrong side of the law. Robberies, syndicates, corrupt badges, and the detectives trying to hold a line. The pull is always the same question: how far will they go?",
	},
	mystery: {
		short: "Clues, suspects, and a truth worth waiting for.",
		lede: "Stories driven by a question someone doesn't want answered. You follow the trail, collect the clues, and try to get there first. The reveal is the reward.",
	},
	war: {
		short: "Life and death at the front.",
		lede: "Stories shaped by combat, whether on the beaches, in the jungle, or in the sky. Some are about heroism, more are about survival and what's left afterward. Rarely easy viewing, and hard to shake.",
	},
	politics: {
		short: "Who has power, and what they do with it.",
		lede: "Elections, backroom deals, whistleblowers, and revolutions. These stories care about how power really works and who pays for it. Expect sharp dialogue and uncomfortable parallels.",
	},
	true: {
		short: "It happened to someone real.",
		lede: "Lives that were actually lived: athletes, artists, criminals, and people who never asked to be remarkable. Knowing it happened changes how every scene lands. You'll be searching for the real photos by the credits.",
	},
	history: {
		short: "Another century, brought back to life.",
		lede: "Stories set firmly in the past, away from the battlefield. Royal courts, old cities, and ways of living that are gone now. Rich in costume and detail, and often closer to today than you'd think.",
	},
	growing: {
		short: "Being young, and figuring it out.",
		lede: "Stories about the years when everything is a first. School, friends, family, and working out who you are when nobody's looking. Sweet, painful, and familiar to anyone who was ever fifteen.",
	},
	family: {
		short: "The people you're stuck with, and love anyway.",
		lede: "Parents and kids, siblings, old wounds, and holidays that go sideways. These stories live in kitchens and car rides, where the real arguments happen. You'll recognize someone.",
	},
	mind: {
		short: "What's going on inside someone's head.",
		lede: "Stories that go inward: obsession, memory, sanity slipping, people you can't quite read. The drama is in what characters think and hide. You'll be second-guessing everyone, including the narrator.",
	},
	showbiz: {
		short: "Behind the curtain of fame and film.",
		lede: "Actors, musicians, comedians, and the machine around them. Stories about making art, chasing fame, and what both cost. Often funny, often brutal, usually a little too honest.",
	},
	sports: {
		short: "Training, rivals, and one big game.",
		lede: "The underdog season, the comeback, the rivalry that defines a career. You don't need to follow the sport to feel the final minutes in your stomach. It's never only about the game.",
	},
	money: {
		short: "Rich, poor, and the gap between.",
		lede: "Stories about wealth and who gets it: traders, strivers, heirs, and the people cleaning up after them. Greed makes great drama, and so does struggle. Expect a few scenes that make you angry in a useful way.",
	},
	future: {
		short: "Tomorrow's world, for better or worse.",
		lede: "Stories about where we're headed: thinking machines, space colonies, cities that have gone wrong. They look forward to say something about now. Sometimes hopeful, often a warning.",
	},
	fantasy: {
		short: "Magic, myths, and made-up realms.",
		lede: "Stories where magic works and legends are true. Quests, prophecies, and creatures from the oldest tales. Pure escape, with real feeling underneath when it's done well.",
	},
}

export const THEME_ALIASES: Record<string, string> = {
	"true-stories": "true",
	"growing-up": "growing",
	"the-mind": "mind",
}

// Styles: how a story looks, sounds and is told. Keyed by the style ids of domain/themes-styles.ts.
export const STYLES: Deck = {
	animated: {
		movies: {
			short: "Drawn, sculpted, or rendered into life.",
			lede: "Hand-drawn classics, stop-motion oddities, and computer animation that looks better every year. Animated movies can go places a camera can't. Don't assume they're for kids.",
		},
		shows: {
			short: "Drawn worlds that run for seasons.",
			lede: "Anime epics, adult comedies, and cartoons for the smallest viewers. Animated series can run for years and still surprise you. Don't assume they're for kids.",
		},
		all: {
			short: "Drawn, sculpted, or rendered into life.",
			lede: "Hand-drawn classics, stop-motion oddities, anime epics, and adult comedies that run for years. Animation can go places a camera can't, in two hours or two hundred episodes. Don't assume it's for kids.",
		},
	},
	documentary: {
		movies: {
			short: "The real world, on camera.",
			lede: "No actors, no script, only what happened and the people it happened to. Documentaries can take you up a mountain, inside a scandal, or into one remarkable life. Half the time you could not make it up.",
		},
		shows: {
			short: "Real stories, episode by episode.",
			lede: "Real stories told over several episodes, with time to follow every thread. Nature, crime, sports, history: each one makes you a temporary expert. Hard to stop once you've started.",
		},
		all: {
			short: "The real world, on camera.",
			lede: "No actors, no script, only what happened and the people it happened to. A film can take you up a mountain or into one remarkable life; a series follows every thread until you're a temporary expert. Half the time you could not make it up.",
		},
	},
	spectacle: {
		short: "Made to be seen as large as possible.",
		lede: "Scale you can feel: armies, storms, cities, space. These are built for the biggest screen and the best sound you can manage. A phone doesn't do them justice.",
	},
	stylized: {
		short: "Every frame looks like nobody else's.",
		lede: "Stories with a look all their own. Bold color, careful symmetry, strange sets, a camera that draws attention to itself on purpose. You could pause almost anywhere and hang it on a wall.",
	},
	music: {
		short: "The soundtrack is doing half the work.",
		lede: "Stories where the music matters as much as the plot. Musicals, performances, and scores you'll go looking for afterward. Worth good headphones.",
	},
	slow: {
		short: "Takes its time, and rewards yours.",
		lede: "Stories that build quietly and trust you to stay with them. Long looks, small shifts, tension that gathers almost without you noticing. Put the phone away, the payoff depends on it.",
	},
	fast: {
		short: "No slow parts. None.",
		lede: "Stories that hit the ground running and don't stop for breath. Quick cuts, quick talk, and a plot that's already two steps ahead. Ideal when your attention span is having a bad day.",
	},
	talky: {
		short: "Great lines, said by people who mean them.",
		lede: "Stories carried by conversation. Arguments, confessions, flirting, and speeches you'll want to quote. If you love listening to smart people talk around what they mean, this is for you.",
	},
	nonlinear: {
		short: "Told out of order, on purpose.",
		lede: "Stories that scramble time. Flashbacks, loops, endings that come first, and pieces that only click together late. Stay sharp, and enjoy the moment it all lines up.",
	},
	graphic: {
		short: "Not for the squeamish.",
		lede: "Violence and gore shown without looking away. Sometimes it's there to shock, sometimes to make you feel the weight of what happens. Check your stomach before pressing play.",
	},
}

export const STYLE_ALIASES: Record<string, string> = {
	"slow-burn": "slow",
	"fast-paced": "fast",
}
