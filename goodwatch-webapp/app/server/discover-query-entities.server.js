// Shared entity resolution for start-page search and the local query lab.
export function createEntityResolver(fetch, origin) {
	const cache = new Map()
	function entityCandidates(entity) {
		const candidates = [{ text: entity.name, name: entity.name }]
		if (entity.quoted) return candidates
		// Peel supported trailing qualifiers repeatedly, in either order. Try the
		// full name first so real titles such as "Scary Movie" remain intact.
		for (let i = 0; i < candidates.length && i < 16; i++) {
			const current = candidates[i]
			const format = current.name.match(
				/\s+(movies?|films?|tv shows?|shows?|series)$/i,
			)
			if (format) {
				const prefix = current.name.slice(0, format.index).trim()
				if (prefix)
					candidates.push({
						...current,
						name: prefix.replace(/['’]s$/i, ""),
						text: current.style ? current.text : prefix,
						format: /movie|film/i.test(format[1]) ? "movie" : "show",
						formatConsumed: Boolean(current.style),
					})
			}
			// Try a trailing score only after the full exact name. This preserves
			// names such as John 5 and titles such as Toy Story 2 when they exist.
			const score = current.name.match(
				/\s+(?:(?:score|rated)\s+)?(?:100|[1-9]?\d)(?:\+|%)?$/i,
			)
			if (score) {
				const prefix = current.name.slice(0, score.index).trim()
				if (prefix) candidates.push({ ...current, name: prefix, text: prefix })
			}

			const style = current.name.match(/\s+(?:styles?|vibes?|feel)$/i)
			if (style) {
				const prefix = current.name.slice(0, style.index).trim()
				if (prefix)
					candidates.push({
						...current,
						name: prefix.replace(/['’]s$/i, ""),
						style: true,
					})
			}
			// A title can contain these words, so split only after the full exact
			// lookup fails. A confirmed prefix exposes the next reference on a pass.
			if (!current.prefix)
				for (const marker of current.name.matchAll(
					/\s+(?:(?:with|starring|directed by|like|similar to)\s+|(?:and|or)\s+)/gi,
				)) {
					const prefix = current.name.slice(0, marker.index).trim()
					if (prefix)
						candidates.push({ name: prefix, text: prefix, prefix: true })
				}
		}
		return candidates.filter(
			(candidate, index, all) =>
				all.findIndex(
					(other) => JSON.stringify(other) === JSON.stringify(candidate),
				) === index,
		)
	}
	async function resolveEntity(e) {
		const lookupKey = `entity:v6:${e.bare}:${e.implicit}:${e.quoted}:${e.parameter}:${e.name.toLowerCase()}`
		if (cache.has(lookupKey)) {
			const cached = cache.get(lookupKey)
			return cached
				? { ...cached, phrase: e.name, entityStart: e.start, entityEnd: e.end }
				: null
		}
		const normalized = (name) =>
			name
				.normalize("NFKD")
				.replace(/\p{M}/gu, "")
				.toLowerCase()
				.replace(/['’]/g, "")
				.replace(/[^\p{L}\p{N}\s]/gu, " ")
				.replace(/\s+/g, " ")
				.replace(/^(?:the|a|an)\s+/, "")
				.trim()
		const kinds = e.bare
			? ["title", "people"]
			: e.parameter === "people"
				? ["people"]
				: e.parameter === "similar" && !e.implicit
					? ["title", "people"]
					: ["title"]
		const fallbacks = [],
			surnameGuesses = []
		let match = null
		for (const candidate of entityCandidates(e)) {
			const results = await Promise.allSettled(
				kinds.map(async (kind) => {
					const readKey = `entity-read:v1:${kind}:${candidate.name.toLowerCase()}`
					if (cache.has(readKey)) return { kind, choices: cache.get(readKey) }
					const path =
						kind === "people"
							? `/api/cast?text=${encodeURIComponent(candidate.name)}`
							: `/api/command-palette?q=${encodeURIComponent(candidate.name)}`
					const response = await fetch(new URL(path, origin), {
						signal: AbortSignal.timeout(8000),
					})
					if (!response.ok)
						throw Error(
							`Discover entity lookup returned HTTP ${response.status}`,
						)
					const data = await response.json()
					const rows = kind === "people" ? data.castMembers : data.titles
					let choices = Array.isArray(rows) ? rows : []
					// The prefix index can miss punctuation and original-language names.
					// The existing TMDB-backed site search provides a bounded exact-name recovery.
					if (
						kind === "title" &&
						!choices.some((row) =>
							[row.title, row.matchedAlias?.text].some(
								(name) =>
									name && normalized(name) === normalized(candidate.name),
							),
						)
					) {
						try {
							const recovery = await fetch(
								new URL(
									`/api/search?query=${encodeURIComponent(candidate.name.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim())}`,
									origin,
								),
								{ signal: AbortSignal.timeout(4000) },
							)
							if (recovery.ok) {
								const body = await recovery.json()
								const recovered = (body.searchResults ?? [])
									.filter(
										(row) =>
											row.adult !== true &&
											["movie", "tv", "show"].includes(row.media_type),
									)
									.map((row) => ({
										mediaType: row.media_type === "movie" ? "movie" : "show",
										tmdbId: row.id,
										title: row.title ?? row.name,
										year: (row.release_date ?? row.first_air_date ?? "").slice(
											0,
											4,
										),
										originalName: row.original_title ?? row.original_name,
									}))
								choices = choices.map((old) => {
									const original = recovered.find(
										(row) =>
											old.mediaType === row.mediaType &&
											old.tmdbId === row.tmdbId,
									)
									return original
										? { ...old, originalName: original.originalName }
										: old
								})
								choices = [
									...choices,
									...recovered.filter(
										(row) =>
											!choices.some(
												(old) =>
													old.mediaType === row.mediaType &&
													old.tmdbId === row.tmdbId,
											),
									),
								]
							}
						} catch {
							/* Keep successful primary lookup results when recovery is unavailable. */
						}
					}
					if (cache.size >= 500) cache.delete(cache.keys().next().value)
					cache.set(readKey, choices)
					return { kind, choices }
				}),
			)
			if (results.every((result) => result.status === "rejected"))
				throw Error("Discover entity lookup unavailable")
			for (const result of results) {
				if (result.status !== "fulfilled") continue
				const { kind, choices } = result.value
				const names = (row) => [
					row.name ?? row.title,
					...(kind === "title"
						? [row.matchedAlias?.text, row.originalName].filter(Boolean)
						: []),
				]
				const wanted = normalized(candidate.name)
				if (!wanted) continue
				const exact = choices.filter((row) =>
					names(row).some((name) => normalized(name) === wanted),
				)
				if (e.bare && kind === "title" && exact.length && !candidate.style) {
					cache.set(lookupKey, null)
					return null
				}
				if (exact.length && !match)
					match = { kind, candidate, selected: exact[0], exact: exact.length }
				if (
					kind === "people" &&
					!e.quoted &&
					wanted.length >= 4 &&
					!wanted.includes(" ")
				) {
					const surname = choices
						.filter(
							(row) =>
								normalized(row.name).endsWith(` ${wanted}`) &&
								Number(row.popularity) >= 1,
						)
						.sort((a, b) => Number(b.popularity) - Number(a.popularity))
					if (
						surname.length &&
						(!surname[1] ||
							Number(surname[0].popularity) >=
								1.8 * Number(surname[1].popularity))
					)
						surnameGuesses.push({
							kind,
							candidate,
							selected: surname[0],
							exact: 0,
							surname: true,
						})
				}
				// A nonempty lookup is not proof of a match. "hanks" must not silently
				// become the title "World War II with Tom Hanks".
				if (kind === "title" && !e.quoted && !candidate.prefix) {
					const prefix = choices.find((row) =>
						names(row).some((name) => normalized(name).startsWith(wanted)),
					)
					if (prefix)
						fallbacks.push({ kind, candidate, selected: prefix, exact: 0 })
				}
			}
			if (match) break
		}
		match ??= surnameGuesses[0] ?? (e.implicit ? null : fallbacks[0])
		if (!match) {
			cache.set(lookupKey, null)
			return null
		}
		const { kind, candidate, selected, exact } = match
		const parameter =
			kind === "people" ? "people" : e.bare ? "similar" : e.parameter
		const value =
			kind === "people"
				? selected.tmdb_id
				: (selected.mediaType === "movie" ? 1e12 : 2e12) + selected.tmdbId
		const result = {
			parameter,
			entityParameter: e.parameter,
			value: String(value),
			phrase: e.name,
			consumedName: candidate.text,
			bare: e.bare,
			entityStart: e.start,
			entityEnd: e.end,
			format: candidate.formatConsumed ? candidate.format : undefined,
			source: "entity lookup",
			reason: `${selected.name ?? selected.title}${selected.year ? ` (${selected.year})` : ""}; ${candidate.style && kind === "title" ? "style/vibe reference mapped to Similar to; " : candidate.style && kind === "people" ? "guess: person style approximated by the existing cast/crew filter; " : kind === "people" && e.parameter === "similar" ? "person reference mapped to existing cast/crew filter; " : e.implicit && e.parameter === "similar" ? "inferred similarity from comparative wording; " : ""}${match.surname ? "guess: most popular surname match" : exact === 1 ? "exact name" : "guess: best lookup match"}`,
		}
		cache.set(lookupKey, result)
		return result
	}

	return resolveEntity
}
