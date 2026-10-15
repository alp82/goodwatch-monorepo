import { createHash } from "node:crypto"
import { SaxesParser } from "saxes"
import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
} from "../../domain/imports.ts"
import { PlexError } from "./plex-http.server.ts"

export function plexFeedUrl(input: string): string {
	try {
		const url = new URL(input)
		if (
			url.protocol === "https:" &&
			url.hostname === "rss.plex.tv" &&
			!url.port &&
			!url.username &&
			!url.password &&
			!url.hash &&
			!url.search &&
			/^\/(?:watchlist\/)?[\w-]+$/.test(url.pathname)
		)
			return url.href
	} catch {
		/* Do not include the private feed URL in errors. */
	}
	throw new PlexError(
		"Use the personal Watchlist RSS URL generated in Plex Watchlist settings (https://rss.plex.tv/…).",
		400,
	)
}

export function readPlexRss(xml: string): ImportObservation[] {
	const rows: ImportObservation[] = []
	const parser = new SaxesParser()
	const stack: string[] = []
	let item: Record<string, string[]> | undefined
	let text = ""
	let root = ""
	parser.on("doctype", () => {
		throw new PlexError("Plex RSS must not contain a document type.")
	})
	parser.on("opentag", (tag) => {
		stack.push(tag.name)
		if (stack.length > 20) throw new PlexError()
		if (stack.length === 1) root = tag.name
		if (tag.name === "item" && stack.join("/") === "rss/channel/item") item = {}
		text = ""
	})
	parser.on("text", (value) => {
		text += value
	})
	parser.on("cdata", (value) => {
		text += value
	})
	parser.on("closetag", (tag) => {
		if (item && stack.length === 4) {
			item[tag.name] ??= []
			item[tag.name].push(text.trim())
		}
		if (item && tag.name === "item") {
			const guids = item.guid ?? []
			const tmdbId =
				Number(guids.find((v) => /^tmdb:\/\/[1-9]\d*$/.test(v))?.slice(7)) ||
				null
			const imdbId =
				guids.find((v) => /^imdb:\/\/tt\d+$/.test(v))?.slice(7) ?? null
			const type = item.category?.find((v) => ["movie", "show"].includes(v))
			const title = (item.title?.[0] ?? "Untitled Plex watchlist item").slice(
				0,
				500,
			)
			rows.push({
				key: `plex:want:${type ?? "unknown"}:${
					tmdbId
						? `tmdb:${tmdbId}`
						: (imdbId ??
							createHash("sha256")
								.update(JSON.stringify([title, guids]))
								.digest("hex"))
				}`,
				kind: "want",
				mediaType: type === "show" ? "show" : "movie",
				title,
				year: null,
				tmdbId,
				imdbId,
				...(!type
					? {
							problem: {
								outcome: "unsupported" as const,
								reason:
									"The Plex feed does not identify this item as a movie or show.",
							},
						}
					: !tmdbId && !imdbId
						? {
								problem: {
									outcome: "unmatched" as const,
									reason:
										"The Plex feed has no TMDB or IMDb identity for this item.",
								},
							}
						: {}),
			})
			if (rows.length > IMPORT_MAX_ROWS)
				throw new PlexError("This Plex feed exceeds 50,000 items.", 400)
			item = undefined
		}
		stack.pop()
		text = ""
	})
	try {
		parser.write(xml).close()
	} catch {
		throw new PlexError("Plex returned an unreadable watchlist RSS feed.")
	}
	if (root !== "rss")
		throw new PlexError("Plex returned an unreadable watchlist RSS feed.")
	return rows
}
