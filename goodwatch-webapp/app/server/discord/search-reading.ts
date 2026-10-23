import type { ReadingChip } from "../combined-search/reading-retrieval.server.ts"

/** Same selection and order as the website's readAsChips: four wants, two avoids, phrases only as a fallback. */
export function readingLine(reading: ReadingChip[] = []) {
	const wants = reading
		.filter((c) => c.kind === "want" || c.kind === "attribute")
		.slice(0, 4)
	const avoids = reading
		.filter((c) => c.kind === "avoid" || c.kind === "excluded")
		.slice(0, 2)
	const chips =
		wants.length || avoids.length
			? [...wants, ...avoids]
			: reading.filter((c) => c.kind === "phrase").slice(0, 4)
	const labels = chips.map((c) => {
		const label = c.text.replace(/_/g, " ").slice(0, 40)
		return c.kind === "avoid" || c.kind === "excluded"
			? `not ${label.replace(/^(not|low)\s+/i, "")}`
			: label
	})
	return labels.length ? `Reads as: ${labels.join(" · ")}` : ""
}

export interface SearchReason {
	text: string
	kind: "attribute" | "dimension" | "mismatch"
}

export function reasonsLine(reasons: SearchReason[] = []) {
	const labels = reasons
		.filter((r) => r.kind !== "mismatch")
		.slice(0, 3)
		.map((r) => {
			const label =
				r.kind === "dimension"
					? r.text.replace(/\s+\d+(?:\.\d+)?$/, "")
					: r.text
			return label
				.replace(/^genre:\s*/i, "")
				.replace(/_/g, " ")
				.slice(0, 40)
		})
	return labels.length ? `Matches: ${labels.join(" · ")}` : ""
}
