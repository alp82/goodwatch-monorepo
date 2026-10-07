// PROTOTYPE - throwaway (issue #368, map #365). The sample shows, the presets (a show plus the presses to make) and
// the decisions that are left, for the page at /prototype/tracking-machine and for the tests.
import type { AnyEvent, Episode, Settings, Show } from "./machine.ts"

// ---------------------------------------------------------------------------------------------------------
// Sample shows
// ---------------------------------------------------------------------------------------------------------

const season = (key: string, number: number, aired: number, listed = aired): Episode[] =>
	Array.from({ length: listed }, (_, index) => ({ id: `${key}-s${number}e${index + 1}`, season: number, number: index + 1, aired: index < aired }))

export const SHOWS: Show[] = [
	{
		key: "ended",
		title: "Harbour Lights",
		about: "Ended. Two seasons of three episodes, all aired.",
		running: false,
		made: 0,
		episodes: [...season("ended", 1, 3), ...season("ended", 2, 3)],
	},
	{
		key: "weekly",
		title: "The Long Winter",
		about: "Running weekly. Season 2 has two episodes out and two listed that have not aired.",
		running: true,
		made: 0,
		episodes: [...season("weekly", 1, 3), ...season("weekly", 2, 2, 4)],
	},
	{
		key: "specials",
		title: "Paper Moons",
		about: "Running, between seasons. One season of five episodes and two specials.",
		running: true,
		made: 0,
		episodes: [...season("specials", 0, 2), ...season("specials", 1, 5)],
	},
	{
		key: "nolist",
		title: "Old Broadcast",
		about: "Ended. TMDB lists no episodes for it.",
		running: false,
		made: 0,
		episodes: [],
	},
]

export const findShow = (key: string | null | undefined) => SHOWS.find((show) => show.key === key) ?? null

// ---------------------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------------------

export interface Preset {
	id: string
	title: string
	show: string
	/** What it sets up and what to look at. */
	about: string
	steps: AnyEvent[]
	/** Switches the preset needs. Loading a preset sets every other switch back to the recommendation. */
	settings?: Partial<Settings>
}

const w = (s: number, n: number): AnyEvent => ({ type: "watch", season: s, number: n })
const u = (s: number, n: number): AnyEvent => ({ type: "unwatch", season: s, number: n })

export const PRESETS: Preset[] = [
	{
		id: "through-ended",
		title: "Watching through an ended show",
		show: "ended",
		about: "Six ticks. The first makes it Watching, the last makes it Seen. Nothing else is involved.",
		steps: [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), w(2, 3)],
	},
	{
		id: "caught-up-airs",
		title: "Catching up on a running show, then an episode airs",
		show: "weekly",
		about: "Five ticks reach Seen, shown as Caught up because the show is running. Then episodes air: the state stays, the line says how many are new. Ticking all of the new ones keeps it Seen; ticking one of several returns it to Watching.",
		steps: [w(1, 1), w(1, 2), w(1, 3), w(2, 1), w(2, 2), { type: "episodeAirs" }, w(2, 3), { type: "episodeAirs" }, { type: "seasonAirs" }, w(2, 4)],
	},
	{
		id: "seen-twice",
		title: "Pressing Seen, then pressing it again",
		show: "ended",
		about: "Two episodes ticked by hand, then Seen marks the other four as one group. One more press removes exactly that group: back to Watching with the two hand ticks.",
		steps: [w(1, 1), w(1, 2), { type: "pressSeen" }, { type: "undoSeen" }],
	},
	{
		id: "on-hold",
		title: "On hold and back",
		show: "weekly",
		about: "On hold is only offered while Watching. Resume brings Watching back, and so does ticking an episode.",
		steps: [w(1, 1), w(1, 2), { type: "hold" }, { type: "resume" }, { type: "hold" }, w(1, 3)],
	},
	{
		id: "dropped-want",
		title: "Dropped with nothing watched, then Want to See",
		show: "ended",
		about: "Dropped with nothing watched is what an import can bring (and what the page offers under M3 b). Want to See clears it to Not started, and the first tick clears Want to See.",
		steps: [{ type: "drop" }, { type: "wantToSee" }, w(1, 1)],
	},
	{
		id: "rate-never-started",
		title: "Rating a show that was never started",
		show: "ended",
		about: "The score does not change the state. The page asks once: Have you seen all of it? Answer it on the show.",
		steps: [{ type: "rate", score: 8 }],
	},
	{
		id: "rewatch",
		title: "A rewatch: pass 2",
		show: "ended",
		about: "Watch again starts pass 2. Progress and the next episode count only pass 2, and the watches of pass 1 stay in the log. Built here only to show it (M4).",
		steps: [{ type: "pressSeen" }, { type: "watchAgain" }, w(1, 1), w(1, 2)],
		settings: { m4: "built" },
	},
	{
		id: "readded",
		title: "TMDB re-adds an episode",
		show: "weekly",
		about: "Three episodes watched, then TMDB removes the last of them and adds it again under a new id. The watch still counts, by season and number.",
		steps: [w(1, 1), w(1, 2), w(1, 3), { type: "episodeReadded" }],
	},
	{
		id: "no-list",
		title: "A show with no episode list",
		show: "nolist",
		about: "Only Seen and its undo, the score, Want to See, Not interested and Dropped work. There is no episode to tick, so watching can never make it Seen.",
		steps: [{ type: "pressSeen" }, { type: "undoSeen" }, { type: "wantToSee" }, { type: "pressSeen" }],
	},
	{
		id: "rate-prompt",
		title: "Three episodes watched: the prompt to rate",
		show: "specials",
		about: "The prompt appears with the third episode, once. Not now ends it for this show.",
		steps: [w(1, 1), w(1, 2), w(1, 3)],
	},
	{
		id: "special",
		title: "Watching a special",
		show: "specials",
		about: "A special is ticked and nothing else moves: the show is still Not started, and progress does not count it.",
		steps: [w(0, 1), w(1, 1), u(0, 1)],
	},
	{
		id: "unwatch-on-hold",
		title: "Unticking the only episode of a show on hold",
		show: "weekly",
		about: "One episode, On hold, then the episode is unticked. On hold stays, because it was chosen (M2). Resume then leads to Not started.",
		steps: [w(1, 1), { type: "hold" }, u(1, 1), { type: "resume" }],
	},
	{
		id: "seen-new-episodes",
		title: "A Seen show gets new episodes",
		show: "weekly",
		about: "Seen, then an episode and a whole season air. The state stays Seen and the line counts the new episodes. Flip M6 to see the alternative: the show returns to Watching with nobody acting.",
		steps: [{ type: "pressSeen" }, { type: "episodeAirs" }, { type: "seasonAirs" }],
	},
]

export const findPreset = (id: string | null | undefined) => PRESETS.find((preset) => preset.id === id) ?? null

// ---------------------------------------------------------------------------------------------------------
// The decisions that are left
// ---------------------------------------------------------------------------------------------------------

export interface DecisionOption {
	/** a, b, c: the id the hub stores. */
	id: string
	label: string
	/** The value of the switch that runs this option. */
	value: string
	recommended?: boolean
}

export interface Decision {
	/** m1..m6: also the id of the hub's question and the key of the switch. */
	id: keyof Settings
	title: string
	text: string
	options: DecisionOption[]
	preset: string
	/** How many steps of the preset are already made when the decision's link opens it. */
	step: number | "all"
}

export const DECISIONS: Decision[] = [
	{
		id: "m1",
		title: "The word for a Seen show that is still running",
		text: "The state is Seen either way. Only the word differs, and TMDB's status picks it: anything but Ended or Canceled counts as running. A show that ends later changes its word from Caught up to Seen without the state moving.",
		options: [
			{ id: "a", label: "Caught up while the show is running, Seen once it has ended", value: "caught_up", recommended: true },
			{ id: "b", label: "Always Seen", value: "seen" },
		],
		preset: "caught-up-airs",
		step: 5,
	},
	{
		id: "m2",
		title: "Unticking the last episode of an On hold or Dropped show",
		text: "From Watching and Seen, nothing watched means Not started. On hold and Dropped were chosen by the member. Do they survive having nothing watched? If they do, Resume on such a show leads to Not started.",
		options: [
			{ id: "a", label: "On hold and Dropped stay", value: "keep", recommended: true },
			{ id: "b", label: "Back to Not started, like from Watching", value: "not_started" },
		],
		preset: "unwatch-on-hold",
		step: 2,
	},
	{
		id: "m3",
		title: "Not interested and Drop before the first watch",
		text: "The glossary calls Not interested a title the person has not seen and does not want, and Dropped a show the person gave up on; \"once the person has watched an episode, Dropped takes its place\". Both hide the show from recommendations and clear Want to See, so before the first watch two buttons would do the same thing. The machine has the row either way (Not started → Dropped), because an import can bring a dropped show with no episodes. The question is what the page offers.",
		options: [
			{ id: "a", label: "One place: Not interested before the first watch, Drop from the first watch. Dropped with nothing watched comes from imports only", value: "not_interested", recommended: true },
			{ id: "b", label: "Both before the first watch: Not interested for \"never\", Drop for \"I tried it elsewhere and gave up\"", value: "both" },
		],
		preset: "dropped-want",
		step: 0,
	},
	{
		id: "m4",
		title: "Watch again",
		text: "Seen → Watching with the pass number raised; progress and the next episode then count only the new pass, and the earlier watches stay in the log. The preset runs it so the rule can be checked.",
		options: [
			{ id: "a", label: "Draw it in the machine, build it later", value: "drawn", recommended: true },
			{ id: "b", label: "Build it with episode tracking", value: "built" },
		],
		preset: "rewatch",
		step: "all",
	},
	{
		id: "m5",
		title: "Rating a title that was never started",
		text: "A score never changes a show's state. When a never-started show gets its first score the page asks once, \"Have you seen all of it?\": \"Yes, all of it\" (the same as pressing Seen), \"I'm partway\" (opens the episode list), \"Just rating\". A film has no machine: rating a film makes it Seen today, and asking there would end that.",
		options: [
			{ id: "a", label: "Shows only, with this wording. Rating a film keeps making it Seen", value: "shows", recommended: true },
			{ id: "b", label: "Films too: a rated film is Seen only after \"Yes\"", value: "shows_and_films" },
			{ id: "c", label: "No question. A score is only a score", value: "never" },
		],
		preset: "rate-never-started",
		step: "all",
	},
	{
		id: "m6",
		title: "A Seen show with new episodes",
		text: "As specified it stays Seen and says how many episodes are new, until the member acts. The alternative returns it to Watching by itself. That would be the only transition nobody makes: the state changes on a catalog refresh, every member's row for the show has to be rewritten by a job when an episode airs (or the stored state stops being the truth), a show finished years ago reappears in Watching, and the Seen press can no longer be taken back.",
		options: [
			{ id: "a", label: "Stays Seen, with \"N new episodes\"", value: "stays", recommended: true },
			{ id: "b", label: "Returns to Watching by itself", value: "returns" },
		],
		preset: "seen-new-episodes",
		step: "all",
	},
]

export const decisionLink = (decision: Decision) => `/prototype/tracking-machine?scenario=${decision.preset}&step=${decision.step}`
