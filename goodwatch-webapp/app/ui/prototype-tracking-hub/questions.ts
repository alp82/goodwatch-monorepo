// PROTOTYPE - throwaway (map #365). Every open question of the four tracking prototypes as an answerable item:
// the options, which one the prototype's notes suggest, and a link that opens the prototype where it shows.
// The tracking-rules questions come from the cases of the playground; the rest are the numbered questions that
// end docs/prototypes/{watch-log,episode-list,watching}/README.md.
import { CASES, caseParam } from "~/domain/prototype-tracking-rules/cases"

export interface HubOption {
	id: string
	label: string
	/** The option in full, where the short label leaves something out. */
	detail?: string
	suggested?: boolean
}

export interface HubQuestion {
	/** Unique across the prototypes: r1..r27, wl1..wl10, el1..el10, w1..w10. */
	id: string
	/** A few words, for the copied summary. */
	short: string
	text: string
	options: HubOption[]
	/** Opens the prototype in the state that shows the question. */
	link: string
	/** The first questions of the tracking rules change settled wording. */
	group?: string
}

export interface HubPrototype {
	key: string
	title: string
	about: string
	link: string
	readme: string
	issue: number
	questions: HubQuestion[]
}

const q = (id: string, short: string, text: string, link: string, suggested: number, labels: string[]): HubQuestion => ({
	id,
	short,
	text,
	link,
	options: labels.map((label, index) => ({ id: "abcde"[index], label, suggested: index === suggested })),
})

const WL = "/prototype/watch-log"
const EL = "/prototype/episode-list"
const W = "/prototype/watching"

export const HUB: HubPrototype[] = [
	{
		key: "tracking-rules",
		title: "Tracking rules",
		about: "What Seen, Watching, caught up and the next episode do in the cases where the settled rules disagree, surprise, or say nothing. A playground: set a case up, press, flip the rule.",
		link: "/prototype/tracking-rules",
		readme: "docs/prototypes/tracking-rules/README.md",
		issue: 368,
		questions: CASES.flatMap((found) =>
			found.questions.map((question) => ({
				id: question.id,
				short: question.title,
				text: found.questions.length > 1 ? `${question.title}. ${found.problem}` : found.problem,
				link: `/prototype/tracking-rules?case=${caseParam(found, found.setups[0])}`,
				group: found.group === "wording" ? "Changes settled wording" : "The rest",
				options: question.options.map((option) => ({
					id: option.id,
					label: option.label,
					detail: option.detail,
					suggested: option.recommended,
				})),
			})),
		),
	},
	{
		key: "watch-log",
		title: "Film watch log",
		about: "How a member sees and corrects the watches of a film, and what Seen does once a watch has a date.",
		link: `${WL}?variant=B`,
		readme: "docs/prototypes/watch-log/README.md",
		issue: 370,
		questions: [
			q("wl1", "Reaching another day after one tap", "How does the person reach another day after one tap on Seen?", `${WL}?variant=B&film=dune2`, 1, [
				"A: an arrow beside Seen",
				"B: a strip after the tap",
				"C: the toast and the log",
			]),
			q("wl2", "Where the log lives", "Is the log always open, one line that opens, or behind the button?", `${WL}?variant=A&film=interstellar`, 1, [
				"Always open (B)",
				"One line that opens (A)",
				"Behind the Seen button (C)",
			]),
			q("wl3", "Seen again with several watches", "Pressing Seen again on a film with several watches: what does it do?", `${WL}?variant=A&remove=log&film=interstellar`, 2, [
				"Remove the last watch",
				"Remove all, after a question",
				"Remove nothing and show the log (\"Remove all N\" at its foot)",
			]),
			q("wl4", "Where undated watches sort", "Where do watches without a date sort in the log?", `${WL}?variant=B&order=dated&film=interstellar`, 0, [
				"At the bottom, below the dated ones",
				"In the order they were recorded",
			]),
			q("wl5", "Telling an import apart", "Is \"Imported from Letterboxd\" under the date enough to tell an import from a watch marked by hand?", `${WL}?variant=B&film=matrix`, 0, [
				"Yes; no badge for watches marked by hand",
				"No; every watch shows where it came from",
			]),
			q("wl6", "Time of day in the log", "Does the log show the time of day?", `${WL}?variant=B&film=interstellar`, 0, [
				"Yes, in grey, only for a watch that has one",
				"No, days only",
			]),
			q("wl7", "Setting a time when editing", "Can the person set a time when they edit a watch?", `${WL}?variant=A&film=interstellar`, 0, [
				"No: a day or \"don't know when\"",
				"Yes, a time too",
			]),
			q("wl8", "Deleting a watch", "Does deleting a watch need a question first?", `${WL}?variant=B&film=interstellar`, 0, [
				"No: removed at once, the toast offers Undo",
				"Yes, ask first",
			]),
			q("wl9", "Count on Seen", "Does Seen show the count (\"3×\", a \"3\" on the card's eye)?", `${WL}?variant=A&film=interstellar`, 0, [
				"Yes, from two watches on",
				"No count",
			]),
			q("wl10", "Date in the Watch next dialog", "Does the Watch next score dialog show the date choice open, or as one line with Change?", `${WL}?variant=A&film=dune2`, 1, [
				"Open, with Just now chosen (B)",
				"One line: \"Watched today, 22:45. Change\" (A, C)",
			]),
		],
	},
	{
		key: "episode-list",
		title: "Episode list",
		about: "How a member marks episodes on the show page: where the list lives, bulk marks, the status control.",
		link: `${EL}?variant=B&show=slow-horses&scenario=watching`,
		readme: "docs/prototypes/episode-list/README.md",
		issue: 369,
		questions: [
			q("el1", "Where the list lives", "Where does the episode list live?", `${EL}?variant=C&show=slow-horses&scenario=watching&sheet=1`, 2, [
				"In the page (A)",
				"A tab beside the ratings (B)",
				"In a sheet (C)",
			]),
			q("el2", "Date of a bulk mark", "Does a bulk mark ask for the date first, or apply with no date and offer one?", `${EL}?variant=B&show=sherlock&scenario=watching`, 1, [
				"Ask first (A, C)",
				"Apply and offer a date (B)",
			]),
			q("el3", "Watched up to here", "\"Watched up to here\": where is it?", `${EL}?variant=B&show=supernatural&scenario=watching`, 3, [
				"Only in the row's ⋯ strip (A)",
				"Offered after a mark (B)",
				"Asked before the mark (C)",
				"Offered after a mark, and in the strip",
			]),
			q("el4", "The status control", "What is the status control?", `${EL}?variant=B&show=slow-horses&scenario=watching`, 1, [
				"Two buttons (A)",
				"A pill with a menu, Dropped in Not interested's place (B)",
				"A three-way switch (C)",
			]),
			q("el5", "What removing Seen removes", "Removing Seen: does it also remove season and \"up to here\" marks? (The same decision as tracking rule r3.) Try Sherlock, then Seen on and off, with the checkbox in the white panel.", `${EL}?variant=A&show=sherlock&scenario=watching`, 1, [
				"Yes, every bulk watch (ADR 0008 as written)",
				"Only what the Seen button made; say so in the ADR",
			]),
			q("el6", "Scored partway", "A show scored partway is Seen by rule and still Watching. Keep both? (The same decision as tracking rule r13.)", `${EL}?variant=B&show=supernatural&scenario=watching`, 0, [
				"Keep both: the score is the taste signal, the status drives Watching",
				"Show only one of the two",
			]),
			q("el7", "A Seen show with new episodes", "It stays Seen, has no status control, shows \"Seen · 3 new episodes\", and watching one does not bring Watching back. Keep it so? (Tracking rule r14 proposes that a watch sets Watching.)", `${EL}?variant=B&show=slow-horses&scenario=seen_new`, 0, [
				"Keep it so",
				"Watching one brings Watching back",
			]),
			q("el8", "A press on a watched check", "A press on a watched episode's check removes the watch at once, with Undo in the toast. Keep?", `${EL}?variant=A&show=chernobyl&scenario=watching`, 0, [
				"Keep: removed at once, with Undo",
				"Open the strip; removal is a second press",
			]),
			q("el9", "Where the rate prompt sits", "The rate prompt is its own card under the buttons, so the hero shows two score controls for a moment.", `${EL}?variant=B&show=chernobyl&scenario=all`, 1, [
				"Keep the card under the buttons",
				"In the sheet; in the hero, the score control's heading becomes the question",
			]),
			q("el10", "A show nobody has started", "What does a show nobody has started show?", `${EL}?variant=A&show=chernobyl&scenario=fresh`, 0, [
				"One quiet link until the first watch (A, C)",
				"The card with \"Start with S1 E1\" (B)",
			]),
		],
	},
	{
		key: "watching",
		title: "Watching views",
		about: "Where the shows a member is in the middle of live: on home and beside the Wishlist.",
		link: `${W}?variant=mix&surface=home&member=six`,
		readme: "docs/prototypes/watching/README.md",
		issue: 371,
		questions: [
			q("w1", "Tonight's pick as an episode", "Should Tonight's pick be able to be an episode? Compare the dashed preview in A and D.", `${W}?variant=mix&surface=home&member=six`, 0, [
				"Yes",
				"No, a title from Watch next only",
			]),
			q("w2", "Watch next and the Wishlist", "Should Watch next stay a view of the Wishlist? Compare the Wishlist area in B and D.", `${W}?variant=merged&surface=wishlist&member=six`, 0, [
				"Yes, it stays a view of the Wishlist",
				"No, merge Watching shows into it (B)",
			]),
			q("w3", "Home: a row or one line", "Home: a row of shows, or one line?", `${W}?variant=view&surface=home&member=six`, 1, [
				"A row of shows (A)",
				"One line (C)",
			]),
			q("w4", "Beside the Wishlist", "Beside the Wishlist: a shelf above the hero, or a second tab? Look with 6 and with 25 shows.", `${W}?variant=section&surface=wishlist&member=many`, 0, [
				"A shelf above the hero (A)",
				"A second tab (C)",
			]),
			q("w5", "A show not watched for a while", "Does a show the member has not watched for a while keep leading?", `${W}?variant=merged&surface=wishlist&member=many`, 0, [
				"No: after 30 days it stays in Watching but is never Tonight's pick",
				"Yes, it keeps leading",
			]),
			q("w6", "Seen shows with new episodes", "Do Seen shows with new episodes sit with the Watching shows?", `${W}?variant=section&surface=wishlist&member=six`, 0, [
				"Yes, at the end of the shelf with a \"Seen\" tag",
				"In a group of their own (C)",
				"No, not in the Watching views",
			]),
			q("w7", "Caught-up shows", "Where do caught-up shows and seasons that start on a date go?", `${W}?variant=mix&surface=wishlist&member=six`, 0, [
				"One compact group under the shelf, open, never on home",
				"With the other Watching shows",
			]),
			q("w8", "One tap to mark the next episode", "Is one tap enough to mark the Next episode watched, with Undo in a toast?", `${W}?variant=mix&surface=wishlist&member=six`, 0, [
				"Yes, and the card moves on to the following episode",
				"No, ask first",
			]),
			q("w9", "A member who tracks nothing", "What does a member who tracks nothing see?", `${W}?variant=section&surface=wishlist&member=none`, 0, [
				"Nothing on home; beside the Wishlist a note with their Wishlist shows to start",
				"Nothing anywhere",
			]),
			q("w10", "\"Watched S1 E1\" on a Wishlist card", "Does a Wishlist show get \"Watched S1 E1\" on its card?", `${W}?variant=mix&surface=wishlist&member=six`, 0, [
				"Yes, on the hero and the largest cards",
				"No",
			]),
		],
	},
]

export const ALL_QUESTIONS = HUB.flatMap((prototype) => prototype.questions)

/** Not prototypes, and not answerable here: work the tracking features wait on. */
export const REMINDERS = [
	{
		issue: 376,
		title: "Episode catalog go-live",
		text: "The copy of TMDB's episode list that every rule above reads from. Nothing here can ship before it is live.",
	},
	{
		issue: 372,
		title: "Collecting export files",
		text: "Sample export files from the import sources, to check what an import brings (dates, statuses, episodes).",
	},
]
