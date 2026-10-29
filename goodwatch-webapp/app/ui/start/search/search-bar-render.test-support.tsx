// Run by search-bar-render.test.ts through vite-node: renders the start page's search bar the way the server does,
// in each of its states, and prints the HTML.
import { renderToString } from "react-dom/server"
import {
	EMPTY_QUERY,
	type StartQuery,
	type StartResults,
	querySignature,
} from "../stage/start-query"
import { StartSearchBar } from "./StartSearchBar"

const READING: StartResults["reading"] = [
	{ kind: "want", text: "Mystery", key: "mystery" },
	{ kind: "phrase", text: "rainy day" },
]

const render = (query: StartQuery, results: Partial<StartResults> = {}) =>
	renderToString(
		<StartSearchBar
			query={query}
			results={{
				signature: querySignature(query),
				status: "idle",
				reading: null,
				...results,
			}}
			setDraft={() => {}}
			search={() => {}}
			clearSearch={() => {}}
		/>,
	)

const searched = (text: string, picks: string[] = []): StartQuery => ({
	draft: text,
	text,
	picks,
})

console.log(
	`__START_SEARCH_BAR__${JSON.stringify({
		empty: render(EMPTY_QUERY),
		typing: render({ ...EMPTY_QUERY, draft: "rainy d" }),
		reading: render(searched("rainy day whodunit"), { status: "loading" }),
		read: render(searched("rainy day whodunit", ["m:funny"]), {
			status: "ready",
			reading: READING,
		}),
		unread: render(searched("zzzz"), { status: "ready", reading: [] }),
	})}`,
)
