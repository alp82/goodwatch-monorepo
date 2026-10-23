import { createServer } from "node:http"
import { once } from "node:events"
import type { AddressInfo } from "node:net"
import { createPlexClient } from "./plex-client.server.ts"
import type { PlexHttp } from "./plex-http.server.ts"

/** Synthetic Plex service. Production's public-HTTPS guard is not bypassed outside this test adapter. */
export async function plexLibraryFixture() {
	const library: Record<string, unknown>[] = [
		{
			ratingKey: "10",
			type: "movie",
			title: "Toy Story",
			year: 1995,
			Guid: [{ id: "tmdb://862" }],
			viewCount: 4,
			userRating: 7.5,
			lastViewedAt: 1600000000,
		},
		{
			ratingKey: "11",
			type: "movie",
			title: "Paris, Texas",
			year: 1984,
			Guid: [{ id: "tmdb://655" }],
			viewCount: 3,
		},
		{
			ratingKey: "12",
			type: "movie",
			title: "Spirited Away",
			year: 2001,
			Guid: [{ id: "tmdb://129" }],
			viewCount: 1,
			lastViewedAt: 946684800,
		},
	]
	const history: Record<string, unknown>[] = [
		{
			historyKey: "/status/sessions/history/1",
			ratingKey: "10",
			type: "movie",
			title: "Toy Story",
			accountID: 1,
			viewedAt: 1600000000,
		},
	]
	const calls: { path: string; token?: string; start: number }[] = []
	const state = {
		pageSize: 2,
		libraryFailure: false,
		historyFailure: false,
		historyFailureAfterFirst: false,
		historyPageSize: 200,
		duplicate: false,
		shrink: false,
		empty: false,
		oversized: false,
		grow: false,
	}
	const server = createServer((req, res) => {
		const url = new URL(req.url ?? "/", "http://fixture")
		const start = Number(req.headers["x-plex-container-start"] ?? 0)
		calls.push({
			path: `${url.pathname}${url.search}`,
			token: req.headers["x-plex-token"] as string | undefined,
			start,
		})
		let data: unknown
		if (url.pathname === "/api/v2/resources")
			data = [
				{
					owned: true,
					provides: "server",
					clientIdentifier: "fixture-server",
					accessToken: "synthetic-server-token",
					connections: [
						{ uri: "https://fixture.plex.direct", local: false, relay: false },
					],
				},
			]
		else if (url.pathname === "/identity")
			data = { MediaContainer: { machineIdentifier: "fixture-server" } }
		else if (
			url.pathname === "/status/sessions/history/all" &&
			!state.historyFailure &&
			!(state.historyFailureAfterFirst && start)
		)
			data = {
				MediaContainer: {
					size: history.slice(start, start + state.historyPageSize).length,
					offset: start,
					totalSize: history.length,
					Metadata: history.slice(start, start + state.historyPageSize),
				},
			}
		else if (url.pathname === "/library/all" && !state.libraryFailure) {
			const rows =
				state.empty && start
					? []
					: library.slice(
							state.duplicate && start ? 0 : start,
							(state.duplicate && start ? 0 : start) + state.pageSize,
						)
			data = {
				MediaContainer: {
					offset: start,
					totalSize: state.oversized
						? 50001
						: state.shrink && start
							? 1
							: library.length + (state.grow && start ? 1 : 0),
					size: rows.length,
					Metadata: rows,
				},
			}
		} else if (url.pathname.startsWith("/library/metadata/")) {
			const item = library.find(
				(row) => row.ratingKey === url.pathname.split("/").at(-1),
			)
			data = { MediaContainer: { Metadata: item ? [item] : [] } }
		} else {
			res.writeHead(503).end()
			return
		}
		res.setHeader("Content-Type", "application/json")
		res.end(JSON.stringify(data))
	})
	server.listen(0, "127.0.0.1")
	await once(server, "listening")
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	const http: PlexHttp = async (input, options) => {
		const url = new URL(input)
		const response = await fetch(`${origin}${url.pathname}${url.search}`, {
			headers: options?.headers,
			method: options?.method,
		})
		if (!response.ok) throw new Error("Synthetic Plex failure")
		return {
			text: await response.text(),
			headers: Object.fromEntries(response.headers),
		}
	}
	return {
		library,
		history,
		calls,
		state,
		client: createPlexClient({ http }),
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	}
}
