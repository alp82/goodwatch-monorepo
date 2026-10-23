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

type LibraryOptions = {
	serverId: string
	historyItems: Set<string>
	getMetadata: (key: string) => Promise<z.infer<typeof plexMetadata>>
	checkTime: () => void
	maxObservations?: number
	read: (
		path: string,
		headers: Record<string, string>,
	) => Promise<{
		data: unknown
		headers: Record<string, string | string[] | undefined>
	}>
}

/** Each library partition can fail without taking retained history or the other partition with it. */
export async function readPlexLibrary(
	options: LibraryOptions,
): Promise<ParsedImport> {
	const result: ParsedImport = {
		source: "plex",
		observations: [],
		warnings: [],
	}
	for (const [types, label] of [
		["1,4", "movie and episode"],
		["2,3", "show and season"],
	]) {
		try {
			const partition = await readPartition(
				{
					...options,
					maxObservations:
						(options.maxObservations ?? IMPORT_MAX_ROWS) -
						result.observations.length,
				},
				types,
			)
			result.observations.push(...partition.observations)
			result.warnings.push(...partition.warnings)
		} catch (error) {
			options.checkTime()
			const reason = error instanceof PlexError ? `${error.message} ` : ""
			result.warnings.push(
				importActionable(
					`This Plex import is partial: the ${label} library could not be read completely. No library ${label} watched state or personal ratings from that scan were imported. ${reason}Retained history and other library results are kept when available. Check Remote Access and the server owner's access, then connect again.`,
				),
			)
		}
	}
	result.warnings = result.warnings.filter(
		(warning, i, all) =>
			all.findIndex((other) => other.message === warning.message) === i,
	)
	return result
}

/** The documented PMS /library/all snapshot, separate from the retained plays. */
async function readPartition(
	options: LibraryOptions,
	types: string,
): Promise<ParsedImport> {
	const observations: ImportObservation[] = []
	const seen = new Set<string>()
	let offset = 0
	let total: number | undefined
	let previousTotal: number | undefined
	let invalidDate = false
	while (true) {
		options.checkTime()
		const response = await options.read(
			`/library/all?type=${types}&includeGuids=1&sort=addedAt:asc`,
			{
				"X-Plex-Container-Start": String(offset),
				"X-Plex-Container-Size": "200",
			},
		)
		const data = pageSchema.parse(response.data).MediaContainer
		const start = Number(
			response.headers["x-plex-container-start"] ?? data.offset ?? 0,
		)
		const reportedTotal = data.totalSize
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
			if (item.userRating != null && item.userRating !== 0) {
				const value = item.userRating
				const valid =
					typeof value === "number" &&
					Number.isFinite(value) &&
					value > 0 &&
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
									reason:
										"Plex personal ratings must be numbers greater than 0 and at most 10; 0 means unrated.",
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
		if (observations.length > (options.maxObservations ?? IMPORT_MAX_ROWS))
			throw new PlexError(
				"The library scan exceeds the remaining space in this 50,000-item import. Try a smaller import.",
			)
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
				"Plex personal ratings round to whole numbers out of 10; 7.5 becomes 8 and positive ratings below 1 become 1. Zero means unrated and is skipped. Plex supplies no rating dates. Watched library items without retained history add one watch using Plex’s last watched date when present, otherwise without a date; view counts do not create repeat watches.",
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
