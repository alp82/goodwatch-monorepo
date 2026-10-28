// PROTOTYPE - throwaway. Where a member's list lives, for the "Your AI app" source: each place has its own preview
// (the left window), its own wording for what the list holds, and its own prompt. Every place encodes the same eight
// titles, so the simulated writes and the Done counts stay the same.
import type { ReactNode } from "react"

export type Rules = { seen: boolean; scores: boolean; want: boolean }
type Rule = { title: string; note: string; phrase: string }

export interface Place {
	key: string
	label: string
	how: string
	window: string
	attachment: string
	opener: string
	rules: Record<keyof Rules, Rule>
	preview: ReactNode
}

const NOTE = [
	"movies 🍿",
	"- arrival ✓ loved it",
	"- dune 2 ✓ 9/10",
	"- severance ✓",
	"- prisoners (tom says!!)",
	"- sicario ✓ meh 6",
	"- incendies",
	"- magnolia ✓",
	"- blade runner 2049",
]

type Msg = { who: string; me?: boolean; text: string; color?: string }
const CHAT: Msg[] = [
	{ who: "Tom", color: "text-sky-700", text: "ok movie night list. you HAVE to see prisoners" },
	{ who: "Anna", color: "text-rose-700", text: "incendies destroyed me. also blade runner 2049 on a big screen" },
	{ who: "Me", me: true, text: "seen arrival, loved it. dune 2 was a 9 for me" },
	{ who: "Tom", color: "text-sky-700", text: "sicario?" },
	{ who: "Me", me: true, text: "meh, 6. finally finished severance and magnolia though" },
]

const SHEET = [
	["Title", "Watched", "Rating"],
	["Arrival", "yes", ""],
	["Dune: Part Two", "yes", "9"],
	["Severance", "yes", ""],
	["Prisoners", "", ""],
	["Sicario", "yes", "6"],
	["Incendies", "", ""],
	["Magnolia", "yes", ""],
	["Blade Runner 2049", "", ""],
]

const EXPORT = `{
  "history": [
    { "title": "Arrival" },
    { "title": "Dune: Part Two",
      "rating": 9 },
    { "title": "Severance" },
    { "title": "Sicario",
      "rating": 6 },
    { "title": "Magnolia" }
  ],
  "watchlist": [
    "Prisoners",
    "Incendies",
    "Blade Runner 2049"
  ]
}`

export const PLACES: Place[] = [
	{
		key: "sheet",
		label: "Spreadsheet",
		how: "Attach the file, or copy the rows and paste them.",
		window: "movies.xlsx",
		attachment: "📎 movies.xlsx",
		opener: "import this sheet into goodwatch.",
		rules: {
			seen: { title: "\"Watched: yes\" is Seen", note: "The Watched column", phrase: "watched = yes means seen" },
			scores: { title: "The Rating column is my score", note: "Out of 10", phrase: "rating is my score out of 10" },
			want: { title: "Unwatched rows go on Want to See", note: "Watched is empty", phrase: "the rest goes on my want to see" },
		},
		preview: (
			<table className="w-full text-left text-xs">
				<tbody>
					{SHEET.map((row, i) => (
						<tr key={i} className={i === 0 ? "bg-gray-200 font-semibold" : "border-t border-black/10"}>
							{row.map((cell, j) => (
								<td key={j} className={`px-2 py-1.5 ${j === 0 ? "" : "text-center tabular-nums"}`}>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		),
	},
	{
		key: "notes",
		label: "Notes",
		how: "Copy the note and paste it into the chat.",
		window: "Notes",
		attachment: `movies 🍿 (${NOTE.length - 1} lines)`,
		opener: "add this note to goodwatch.",
		rules: {
			seen: { title: "Ticked titles are Seen", note: "✓, x, done, watched", phrase: "✓ means i've seen it" },
			scores: { title: "Numbers are scores", note: "9/10, 4 stars, meh 6", phrase: "numbers are my scores" },
			want: { title: "Everything else goes on Want to See", note: "No tick, no score", phrase: "the rest goes on my want to see" },
		},
		preview: (
			<pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">{NOTE.join("\n")}</pre>
		),
	},
	{
		key: "screenshot",
		label: "Screenshot",
		how: "Take a screenshot of the chat and attach it. Your AI app reads the titles off the picture.",
		window: "WhatsApp · Movie night 🎬",
		attachment: "📷 Screenshot of the group chat",
		opener: "these are from our movie group chat.",
		rules: {
			seen: { title: "What I said I've seen is Seen", note: "Messages from you", phrase: "the ones i said i've seen are seen" },
			scores: { title: "Scores I gave are scores", note: "\"dune 2 was a 9\", \"meh, 6\"", phrase: "use the scores i gave" },
			want: { title: "What my friends recommend goes on Want to See", note: "Messages from everyone else", phrase: "add what my friends recommend to my want to see" },
		},
		preview: (
			<div className="flex flex-col gap-1.5 bg-[#ece5dd] px-3 py-3 text-[13px] leading-snug text-gray-900">
				{CHAT.map((m, i) => (
					<div
						key={i}
						className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm ${m.me ? "self-end bg-[#d9fdd3]" : "self-start bg-white"}`}
					>
						{!m.me && <span className={`block text-xs font-semibold ${m.color}`}>{m.who}</span>}
						{m.text}
					</div>
				))}
			</div>
		),
	},
	{
		key: "app",
		label: "Anything else",
		how: "Any app, any site, any format, any time: an export from an app GoodWatch doesn't import yet, a JSON or CSV file, a PDF, a webpage, a photo of a paper list. Attach it or paste it.",
		window: "export-from-any-app.json",
		attachment: "📎 export-from-any-app.json",
		opener: "here's my export from another app, bring it into goodwatch.",
		rules: {
			seen: { title: "Watch history is Seen", note: "History, completed, watched_at", phrase: "the history is what i've seen" },
			scores: { title: "Ratings are my scores", note: "Whatever scale it uses", phrase: "keep my ratings" },
			want: { title: "The watchlist goes on Want to See", note: "Watchlist, planned, to watch", phrase: "the watchlist goes on my want to see" },
		},
		preview: (
			<pre className="whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-snug">{EXPORT}</pre>
		),
	},
]

export type PlaceKey = string
export const placeOf = (key: PlaceKey) => PLACES.find((p) => p.key === key) ?? PLACES[0]

export const promptFor = (r: Rules, key: PlaceKey = "notes") => {
	const p = placeOf(key)
	const parts = (["seen", "scores", "want"] as const).filter((k) => r[k]).map((k) => p.rules[k].phrase)
	return parts.length ? `${p.opener} ${parts.join(", ")}` : p.opener
}
