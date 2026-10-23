import { z } from "zod"
import { createHash } from "node:crypto"
import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ParsedImport,
	importInfo,
	importActionable,
} from "../../domain/imports.ts"
import { PlexError } from "./plex-http.server.ts"
import { plexMetadata, plexIds } from "./plex-metadata.server.ts"

const itemSchema = plexMetadata.extend({
	ratingKey: z.string().regex(/^\d+$/),
	viewCount: z.number().int().nonnegative().optional(),
	lastViewedAt: z.unknown().optional(),
	userRating: z.unknown().optional(),
})
const pageSchema = z.object({
	MediaContainer: z.object({
		size: z.number().int().nonnegative(),
		totalSize: z.number().int().nonnegative().optional(),
		offset: z.number().int().nonnegative().optional(),
		Metadata: z.array(z.unknown()).default([]),
	}),
})

/** The documented PMS /library/all snapshot, separate from the retained plays. */
export async function readPlexLibrary(options: {
	serverId: string
	historyItems: Set<string>
	getMetadata: (key: string) => Promise<z.infer<typeof plexMetadata>>
	checkTime: () => void
	read: (
		path: string,
		headers: Record<string, string>,
	) => Promise<{
		data: unknown
		headers: Record<string, string | string[] | undefined>
	}>
}): Promise<ParsedImport> {
	const observations: ImportObservation[] = []
	const seen = new Set<string>()
	let offset = 0
	let total: number | undefined
	let previousTotal: number | undefined
	let invalidDate = false
	while (true) {
		options.checkTime()
		let response: Awaited<ReturnType<typeof options.read>>
		try {
			response = await options.read(
				"/library/all?type=1,2,3,4&includeGuids=1&sort=addedAt:asc",
				{
					"X-Plex-Container-Start": String(offset),
					"X-Plex-Container-Size": "200",
				},
			)
		} catch {
			options.checkTime()
			return {
				source: "plex",
				observations: [],
				warnings: [
					importActionable(
						"The Plex library could not be read. No library watched state or personal ratings from that server were imported. Check Remote Access and the server owner's access, then connect again. Retained history and the watchlist are read separately.",
					),
				],
			}
		}
		const data = pageSchema.parse(response.data).MediaContainer
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
				"Plex library changed, exceeded 50,000 items, or returned an incomplete page. Please connect again.",
			)
		total ??= reportedTotal
		previousTotal = reportedTotal
		for (const raw of data.Metadata.slice(
			0,
			total === undefined ? undefined : total - offset,
		)) {
			options.checkTime()
			const parsed = itemSchema.safeParse(raw)
			if (!parsed.success) {
				const identity = z
					.object({
						ratingKey: itemSchema.shape.ratingKey.optional(),
						title: z.string().max(500).optional(),
					})
					.safeParse(raw)
				observations.push({
					key: `plex:library-invalid:${options.serverId}:${(identity.success && identity.data.ratingKey) || createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`,
					kind: "unsupported",
					mediaType: "movie",
					title:
						(identity.success && identity.data.title) ||
						"Unreadable Plex library item",
					year: null,
					tmdbId: null,
					imdbId: null,
					problem: {
						outcome: "invalid",
						reason:
							"This Plex library item is missing or has invalid metadata or watched state.",
					},
				})
				continue
			}
			const item = parsed.data
			if (seen.has(item.ratingKey))
				throw new PlexError(
					"Plex returned duplicate library pages. Please connect again.",
				)
			seen.add(item.ratingKey)
			if (
				!["movie", "show", "season", "episode"].includes(item.type) ||
				(!item.viewCount && item.userRating == null)
			)
				continue
			const scoped = item.type === "episode" || item.type === "season"
			let parent: z.infer<typeof plexMetadata> = item
			let problem: ImportObservation["problem"]
			if (scoped) {
				try {
					parent = await options.getMetadata(
						(item.type === "episode"
							? item.grandparentRatingKey
							: item.parentRatingKey) ?? "",
					)
					if (parent.type !== "show") throw new PlexError()
				} catch {
					problem = {
						outcome: "unmatched",
						reason:
							"Plex parent-show metadata is unavailable for this library item.",
					}
				}
			}
			const match = plexIds(parent)
			const base: Omit<ImportObservation, "key" | "kind"> = {
				mediaType: item.type === "movie" ? "movie" : "show",
				title: parent.title,
				year: parent.year ?? null,
				tmdbId: problem ? null : match.tmdbId,
				imdbId: problem ? null : match.imdbId,
				...(scoped
					? {
							season:
								item.type === "episode"
									? (item.parentIndex ?? null)
									: (item.index ?? null),
							episodeNumbering: "unknown" as const,
						}
					: {}),
				...(item.type === "episode"
					? {
							episode: item.index ?? null,
							episodeTmdbId: plexIds(item).tmdbId,
							episodeTvdbId: plexIds(item).tvdbId,
							episodeName: item.title,
						}
					: {}),
				...(problem ? { problem } : {}),
			}
			if (item.userRating != null) {
				const value = item.userRating
				const valid =
					typeof value === "number" &&
					Number.isFinite(value) &&
					value >= 0 &&
					value <= 10
				observations.push({
					...base,
					key: `plex:rating:${options.serverId}:${item.ratingKey}`,
					kind: scoped ? "unsupported" : "rating",
					score: valid
						? scoped
							? value
							: Math.max(1, Math.round(value))
						: null,
					...(!valid
						? {
								problem: {
									outcome: "invalid" as const,
									reason: "Plex personal ratings must be numbers from 0 to 10.",
								},
							}
						: scoped
							? {
									problem: {
										outcome: "unsupported" as const,
										reason:
											"Season and episode scores are kept here, not applied as whole-show ratings.",
									},
								}
							: {}),
				})
			}
			if (
				(item.type === "movie" || item.type === "episode") &&
				item.viewCount &&
				!options.historyItems.has(item.ratingKey)
			) {
				const date =
					typeof item.lastViewedAt === "number" &&
					Number.isInteger(item.lastViewedAt) &&
					Number.isFinite(new Date(item.lastViewedAt * 1000).getTime())
						? new Date(item.lastViewedAt * 1000).toISOString()
						: null
				invalidDate ||= item.lastViewedAt != null && !date
				observations.push({
					...base,
					key: `plex:library-watch:${options.serverId}:${item.ratingKey}`,
					kind: "watch",
					watchedAt: date,
					precision: date ? "moment" : "unknown",
				})
			}
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
				"Plex returned incomplete library pages. Please connect again.",
			)
	}
	return {
		source: "plex",
		observations,
		warnings: [
			importInfo(
				"Plex personal ratings round to whole numbers out of 10; 7.5 becomes 8 and ratings below 1 become 1. Plex supplies no rating dates. Watched library items without retained history add one watch using Plex’s last watched date when present, otherwise without a date; view counts do not create repeat watches.",
			),
			...(invalidDate
				? [
						importInfo(
							"Plex returned an invalid last watched date; those library watches stay undated.",
						),
					]
				: []),
		],
	}
}
