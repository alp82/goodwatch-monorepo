import type { TasteTitle } from "./model.ts"

/** The summary's agreement card, with stable input order breaking equal gaps and scores. */
export function agreementTitle(titles: Record<string, TasteTitle>) {
	return Object.values(titles)
		.filter((t) => t.score != null && t.gw != null && t.score >= 8)
		.sort(
			(a, b) =>
				Math.abs((a.score ?? 0) * 10 - (a.gw ?? 0)) -
					Math.abs((b.score ?? 0) * 10 - (b.gw ?? 0)) ||
				(b.score ?? 0) - (a.score ?? 0),
		)[0]
}
