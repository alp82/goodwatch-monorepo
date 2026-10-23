import { createHash } from "node:crypto"
import { z } from "zod"
import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ImportWarning,
	type ParsedImport,
	importActionable,
	importInfo,
} from "../../domain/imports.ts"
import { PlexError, type PlexHttp, createPlexHttp } from "./plex-http.server.ts"

import {
	plexMetadata as metadata,
	plexIds as ids,
} from "./plex-metadata.server.ts"
import { readPlexLibrary } from "./plex-library.server.ts"
import { plexFeedUrl, readPlexRss } from "./plex-rss.server.ts"

const id = z.number().int().positive()
const historyRow = z.object({
	historyKey: z.string().regex(/^\/status\/sessions\/history\/\d+$/),
	ratingKey: z.string().optional(),
	title: z.string().max(500),
	type: z.string(),
	accountID: id,
	viewedAt: z
		.number()
		.int()
		.refine((value) => Number.isFinite(new Date(value * 1000).getTime())),
})
const page = z.object({
	MediaContainer: z.object({
		size: z.number().int().nonnegative(),
		totalSize: z.number().int().nonnegative().optional(),
		offset: z.number().int().nonnegative().optional(),
		Metadata: z.array(z.unknown()).default([]),
	}),
})
const serverResource = z.object({
	owned: z.literal(true),
	provides: z.string(),
	clientIdentifier: z.string().regex(/^[\w-]{1,200}$/),
	accessToken: z.string().min(1),
	connections: z
		.array(
			z.object({ uri: z.string(), local: z.boolean(), relay: z.boolean() }),
		)
		.max(20),
})
const resources = z
	.array(z.object({ owned: z.boolean(), provides: z.string() }).passthrough())
	.max(100)
export const PLEX_UNREACHABLE =
	"GoodWatch could not reach your Plex Media Server. No history from that server was imported. Enable Plex Remote Access with a public HTTPS connection, then connect again; local network addresses cannot be reached from GoodWatch."

export function createPlexClient(
	options: { http?: PlexHttp; now?: () => number } = {},
) {
	const http = options.http ?? createPlexHttp()
	async function json(
		url: string,
		clientId: string,
		token?: string,
		extra: Record<string, string> = {},
	) {
		const reply = await http(url, {
			headers: {
				Accept: "application/json",
				"X-Plex-Product": "GoodWatch",
				"X-Plex-Client-Identifier": clientId,
				...(token ? { "X-Plex-Token": token } : {}),
				...extra,
			},
		})
		try {
			return {
				data: JSON.parse(reply.text) as unknown,
				headers: reply.headers,
			}
		} catch {
			throw new PlexError()
		}
	}
	type ReadContext = {
		clientId: string
		read: typeof json
		checkTime: () => void
	}
	async function discoverServers(
		token: string,
		{ clientId, read }: ReadContext,
	) {
		return resources
			.parse(
				(
					await read(
						"https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1",
						clientId,
						token,
					)
				).data,
			)
			.filter((s) => s.owned && s.provides.split(",").includes("server"))
			.map((s) => serverResource.parse(s))
	}
	async function serverConnection(
		server: z.infer<typeof serverResource>,
		{ clientId, read, checkTime }: ReadContext,
	) {
		checkTime()
		let base: string | undefined
		for (const connection of [...server.connections].sort(
			(a, b) => Number(a.relay) - Number(b.relay),
		)) {
			try {
				checkTime()
				const url = new URL(connection.uri)
				if (
					url.protocol !== "https:" ||
					url.username ||
					url.password ||
					url.search ||
					url.hash ||
					!["", "/"].includes(url.pathname)
				)
					continue
				const identity = z
					.object({
						MediaContainer: z.object({
							machineIdentifier: z.literal(server.clientIdentifier),
						}),
					})
					.safeParse((await read(`${url.origin}/identity`, clientId)).data)
				if (identity.success) {
					base = url.origin
					break
				}
			} catch {
				/* Try the next advertised connection, without exposing its address. */
			}
		}
		return base
	}
	async function readServerImport(
		server: z.infer<typeof serverResource>,
		context: ReadContext,
		maxItems: number,
	): Promise<ParsedImport> {
		const { clientId, read, checkTime } = context
		const observations: ImportObservation[] = []
		const warnings: string[] = []
		const base = await serverConnection(server, context)
		checkTime()
		if (!base)
			return {
				source: "plex",
				observations,
				warnings: [
					importActionable(
						`${PLEX_UNREACHABLE} No library watched state or personal ratings from that server were imported.`,
					),
				],
			}

		const cache = new Map<string, z.infer<typeof metadata>>()
		const getMetadata = async (key: string) => {
			if (!/^\d+$/.test(key)) throw new PlexError()
			const cached = cache.get(key)
			if (cached) return cached
			const result = z
				.object({
					MediaContainer: z.object({
						Metadata: z.array(metadata).length(1),
					}),
				})
				.parse(
					(
						await read(
							`${base}/library/metadata/${key}?skipRefresh=1&includeGuids=1`,
							clientId,
							server.accessToken,
						)
					).data,
				).MediaContainer.Metadata[0]
			cache.set(key, result)
			return result
		}
		const historyItems = new Set<string>()
		const seen = new Set<string>()
		let offset = 0
		let total: number | undefined
		let previousTotal: number | undefined
		while (true) {
			checkTime()
			let response: Awaited<ReturnType<typeof read>>
			try {
				response = await read(
					`${base}/status/sessions/history/all?accountID=1&sort=viewedAt:asc`,
					clientId,
					server.accessToken,
					{
						"X-Plex-Container-Start": String(offset),
						"X-Plex-Container-Size": "200",
					},
				)
			} catch {
				checkTime()
				observations.splice(0)
				historyItems.clear()
				warnings.push(
					`${PLEX_UNREACHABLE} Also check that this Plex account can read server history.`,
				)
				break
			}
			const data = page.parse(response.data).MediaContainer
			const start = Number(
				response.headers["x-plex-container-start"] ?? data.offset ?? 0,
			)
			const count =
				response.headers["x-plex-container-total-size"] ?? data.totalSize
			const reportedTotal = count === undefined ? undefined : Number(count)
			if (
				start !== offset ||
				data.size !== data.Metadata.length ||
				(total === undefined && offset + data.size > IMPORT_MAX_ROWS) ||
				(previousTotal !== undefined &&
					(reportedTotal === undefined || reportedTotal < previousTotal)) ||
				(reportedTotal !== undefined &&
					(!Number.isSafeInteger(reportedTotal) ||
						reportedTotal < offset + data.size ||
						(total === undefined && reportedTotal > IMPORT_MAX_ROWS)))
			)
				throw new PlexError(
					"Plex history changed or returned an incomplete page. Please connect again.",
				)
			total ??= reportedTotal
			previousTotal = reportedTotal
			for (const raw of data.Metadata.slice(
				0,
				total === undefined ? undefined : total - offset,
			)) {
				checkTime()
				const owner = z.object({ accountID: z.number() }).safeParse(raw)
				if (owner.success && owner.data.accountID !== 1) continue
				const parsed = historyRow.safeParse(raw)
				if (!parsed.success) {
					const identity = z
						.object({
							historyKey: historyRow.shape.historyKey.optional(),
							title: z.string().max(500).optional(),
						})
						.safeParse(raw)
					observations.push({
						key: `plex:watch:${server.clientIdentifier}:${(identity.success && identity.data.historyKey) || createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`,
						kind: "watch",
						mediaType: "movie",
						title:
							(identity.success && identity.data.title) ||
							"Unreadable Plex play",
						year: null,
						tmdbId: null,
						imdbId: null,
						problem: {
							outcome: "unmatched",
							reason:
								"This Plex history row is missing or has invalid play information.",
						},
					})
					continue
				}
				const row = parsed.data
				if (seen.has(row.historyKey))
					throw new PlexError(
						"Plex returned duplicate history pages. Please connect again.",
					)
				seen.add(row.historyKey)
				// Owned servers identify their owner as local account 1, not the plex.tv ID:
				// https://forums.plex.tv/t/api-users-play-history/796964/2
				// An owner token may see everyone; recheck even when filtering on the server.
				if (row.accountID !== 1) continue
				const observation: ImportObservation = {
					key: `plex:watch:${server.clientIdentifier}:${row.historyKey}`,
					kind: "watch",
					mediaType: row.type === "episode" ? "show" : "movie",
					title: row.title,
					year: null,
					tmdbId: null,
					imdbId: null,
					watchedAt: new Date(row.viewedAt * 1000).toISOString(),
					precision: "moment",
				}
				try {
					const item = await getMetadata(row.ratingKey ?? "")
					if (
						item.type !== row.type ||
						(item.type !== "movie" && item.type !== "episode")
					)
						observation.problem = {
							outcome: "unsupported",
							reason: "This Plex history item is not a movie or episode.",
						}
					else {
						const parent =
							item.type === "episode"
								? await getMetadata(item.grandparentRatingKey ?? "")
								: item
						if (item.type === "episode" && parent.type !== "show")
							throw new PlexError()
						const match = ids(parent)
						if (item.type === "episode")
							Object.assign(observation, {
								mediaType: "show",
								season: item.parentIndex ?? null,
								episode: item.index ?? null,
								episodeNumbering: "unknown",
								episodeTmdbId: ids(item).tmdbId,
								episodeTvdbId: ids(item).tvdbId,
								episodeName: item.title,
							})
						Object.assign(observation, {
							title: parent.title,
							year: parent.year ?? null,
							tmdbId: match.tmdbId,
							imdbId: match.imdbId,
						})
					}
				} catch {
					observation.problem = {
						outcome: "unmatched",
						reason:
							"Plex metadata for this play is unavailable; the item may have been removed from the server.",
					}
				}
				checkTime()
				if (!observation.problem && row.ratingKey)
					historyItems.add(row.ratingKey)
				observations.push(observation)
				if (observations.length > IMPORT_MAX_ROWS)
					throw new PlexError("This Plex import exceeds 50,000 items.", 400)
			}
			offset += data.size
			const paginated =
				response.headers["x-plex-container-start"] !== undefined ||
				data.offset !== undefined
			if (
				(total !== undefined && offset >= total) ||
				(total === undefined && (!paginated || !data.size))
			)
				break
			if (!data.size)
				throw new PlexError(
					"Plex returned incomplete history. Please connect again.",
				)
		}
		const library = await readPlexLibrary({
			maxObservations: Math.max(0, maxItems - observations.length),
			serverId: server.clientIdentifier,
			historyItems,
			getMetadata,
			checkTime,
			read: (path, extra) =>
				read(`${base}${path}`, clientId, server.accessToken, extra),
		})
		observations.push(...library.observations)
		return {
			source: "plex",
			observations,
			warnings: [...warnings.map(importActionable), ...library.warnings],
		}
	}
	async function readFeed(feedUrl?: string): Promise<ParsedImport> {
		const observations: ImportObservation[] = []
		const warnings: ImportWarning[] = []
		if (feedUrl) {
			try {
				observations.push(
					...readPlexRss(
						(
							await http(feedUrl, {
								headers: { Accept: "application/rss+xml, application/xml" },
							})
						).text,
					),
				)
				warnings.push(
					importInfo(
						"Only items present in the Plex watchlist RSS feed were read. The feed may not include your complete watchlist; no missing items were inferred.",
					),
				)
			} catch (error) {
				warnings.push(
					importActionable(
						`${
							error instanceof PlexError && error.status === 400
								? `${error.message} `
								: ""
						}The Plex watchlist RSS feed could not be read. No Want to See items from the feed were imported. Generate your personal feed in Plex Watchlist settings and connect again.`,
					),
				)
			}
		} else
			warnings.push(
				importActionable(
					"No watchlist RSS feed was supplied; Want to See was not imported. Plex Pass members can generate their personal feed in Plex Watchlist settings.",
				),
			)
		return { source: "plex", observations, warnings }
	}
	return {
		async createPin(clientId: string): Promise<{ id: string; code: string }> {
			const response = await http("https://plex.tv/api/v2/pins?strong=true", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"X-Plex-Product": "GoodWatch",
					"X-Plex-Client-Identifier": clientId,
				},
			})
			const pin = z
				.object({ id, code: z.string().min(1).max(200) })
				.parse(JSON.parse(response.text))
			return { id: String(pin.id), code: pin.code }
		},
		async claimPin(pinId: string, clientId: string): Promise<string | null> {
			if (!/^\d+$/.test(pinId)) throw new PlexError()
			return z
				.object({ authToken: z.string().min(1).nullable() })
				.parse(
					(await json(`https://plex.tv/api/v2/pins/${pinId}`, clientId)).data,
				).authToken
		},
		async readImport(
			token: string,
			clientId: string,
			feed?: string,
		): Promise<ParsedImport> {
			const now = options.now ?? Date.now
			const deadline = now() + 5 * 60_000
			const checkTime = () => {
				if (now() >= deadline)
					throw new PlexError(
						"This Plex import took too long. Please connect again.",
					)
			}
			const read: typeof json = async (...args) => {
				checkTime()
				const response = await json(...args)
				checkTime()
				return response
			}
			const feedUrl = feed ? plexFeedUrl(feed) : undefined
			const observations: ImportObservation[] = []
			const warnings: ImportWarning[] = []
			const context = { clientId, read, checkTime }
			const servers = await discoverServers(token, context)
			if (!servers.length)
				warnings.push(
					importActionable(
						"Plex reported no servers owned by this account. No server watches or personal ratings were imported. Sign in with the account that owns your Plex Media Server and connect again. A watchlist RSS feed can still import Want to See without a server.",
					),
				)
			for (const server of servers) {
				const result = await readServerImport(
					server,
					context,
					IMPORT_MAX_ROWS - observations.length,
				)
				observations.push(...result.observations)
				warnings.push(...result.warnings)
				if (observations.length > IMPORT_MAX_ROWS)
					throw new PlexError("This Plex import exceeds 50,000 items.", 400)
			}
			checkTime()
			const watchlist = await readFeed(feedUrl)
			observations.push(...watchlist.observations)
			warnings.push(...watchlist.warnings)

			if (observations.length > IMPORT_MAX_ROWS)
				throw new PlexError("This Plex import exceeds 50,000 items.", 400)
			checkTime()
			return { source: "plex", observations, warnings }
		},
	}
}
export type PlexClient = ReturnType<typeof createPlexClient>
