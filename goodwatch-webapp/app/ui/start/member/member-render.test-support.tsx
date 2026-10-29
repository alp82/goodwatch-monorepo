// Run by member-render.test.ts through vite-node: renders a member's start the way the server does, for members with
// more and less on their lists, and prints the HTML.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import {
	IDLE_RESULTS,
	type StartResults,
	querySignature,
} from "../stage/start-query"
import { DoorSection, ReservedRoom } from "./Doors"
import { MemberResults } from "./MemberResults"
import { MemberStart } from "./MemberStart"
import { type DoorKey, doorsOf, reserveOf } from "./doors"
import type { MemberStartData, MemberStartLater } from "./member-data"
import { FEW, FULL, MEMBERS } from "./member-fixtures.test-support"

const shelf: StartTitle[] = Array.from({ length: 12 }, (_, i) => ({
	media_type: i % 2 ? "show" : "movie",
	tmdb_id: 900 + i,
	title: `Shelf ${i + 1}`,
	release_year: 2000 + i,
	poster_path: `/shelf${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 70 + i,
}))

const render = (data: MemberStartData, later?: MemberStartLater) =>
	renderToString(
		<QueryClientProvider client={new QueryClient()}>
			<MemoryRouter>
				<MemberStart shelf={shelf} data={data} later={later} />
			</MemoryRouter>
		</QueryClientProvider>,
	)

/**
 * One door's section as its list goes from on its way to each answer it can bring: a full grid, a few titles, and
 * nothing it could read. The reserve is the one the section keeps from the first render on.
 */
function sectionStates(base: MemberStartData, key: DoorKey) {
	const pending = { ...base, forYou: undefined, hot: undefined }
	const reserve = reserveOf(pending, key)
	if (!reserve) throw new Error(`${key} has no reserve`)
	const list = key === "hot" ? base.hot : base.forYou
	const answers: Record<string, MemberStartData> = {
		pending,
		full: base,
		sparse: {
			...base,
			[key]: list && { titles: list.titles.slice(0, 2), total: 2 },
		},
		error: { ...base, [key]: null },
	}
	const section = (data: MemberStartData) => {
		const door = doorsOf(data).find((d) => d.key === key)
		if (!door) throw new Error(`no ${key} door`)
		return renderToString(
			<QueryClientProvider client={new QueryClient()}>
				<MemoryRouter>
					<DoorSection
						door={door}
						reserve={reserve}
						filter="all"
						onFilter={() => {}}
					/>
				</MemoryRouter>
			</QueryClientProvider>,
		)
	}
	return {
		room: renderToString(
			<MemoryRouter>
				<ReservedRoom reserve={reserve} />
			</MemoryRouter>,
		),
		...Object.fromEntries(
			Object.entries(answers).map(([name, data]) => [name, section(data)]),
		),
	}
}

/** A member's results line for a search that found 1,234 titles, in each services scope. */
function resultsLine(scope: "any" | "mine") {
	const query = { text: "space", picks: [] }
	const results: StartResults = {
		...IDLE_RESULTS,
		status: "ready",
		signature: querySignature(query),
		cards: (FULL.wishlist?.titles ?? []).slice(0, 4),
		total: 1234,
	}
	return renderToString(
		<QueryClientProvider client={new QueryClient()}>
			<MemoryRouter>
				<MemberResults
					query={query}
					results={results}
					scope={scope}
					onBack={() => {}}
					onRetry={() => {}}
				/>
			</MemoryRouter>
		</QueryClientProvider>,
	)
}

console.log(
	`__MEMBER_START_RENDER__${JSON.stringify({
		...Object.fromEntries(
			Object.entries(MEMBERS).map(([name, data]) => [name, render(data)]),
		),
		// For you and Hot on socials still on their way, as the server sends a full member's page.
		later: (() => {
			const { forYou: _f, hot: _h, ...data } = FULL
			const never = new Promise<never>(() => {})
			return render(data, { forYou: never, hot: never })
		})(),
		results: { any: resultsLine("any"), mine: resultsLine("mine") },
		sections: {
			hot: sectionStates(FULL, "hot"),
			forYou: sectionStates(FULL, "forYou"),
			forming: sectionStates(FEW, "forYou"),
		},
	})}`,
)
