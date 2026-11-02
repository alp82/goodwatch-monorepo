export function relaxQuery(query: string, phrases: readonly string[]): string {
	let text = query
	for (const phrase of [
		...new Set(phrases.map((p) => p.trim()).filter(Boolean)),
	].sort((a, b) => b.length - a.length)) {
		const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			quoted = [...text.matchAll(/"[^"]*"|“[^”]*”/g)]
		text = text.replace(
			new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"),
			(match, offset: number) =>
				quoted.some(
					(q) => offset >= q.index! && offset < q.index! + q[0].length,
				)
					? match
					: " ",
		)
	}
	return text
		.replace(/\b(?:and|or)\s+(?=(?:and|or)\b)/gi, "")
		.replace(/^\s*(?:(?:and|or|but)\b[\s,;]*)+/i, "")
		.replace(/(?:[\s,;]*\b(?:and|or|but))+\s*$/i, "")
		.replace(/\s+/g, " ")
		.trim()
}
