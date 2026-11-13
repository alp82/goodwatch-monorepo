import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import {
	type PersonAwardRow,
	type PersonAwards,
	summarizePersonAwards,
} from "./person-awards.ts"
import { optionalTitlePart } from "./title-page-budget.ts"

// Awards change when a new award generation is published, at most daily. Every filter view of a person page and every
// MCP person read asked Crate again; in November 2026 it was among the heaviest webapp statements on the cluster.
const TTL_MINUTES = 6 * 60

async function readPersonAwards({
	personId,
}: { personId: number }): Promise<{ awards: PersonAwards | null }> {
	const rows = await query<PersonAwardRow>(
		`SELECT result_id, award_name, category_name, ceremony_year, has_win, has_nomination, source_names, reference_urls, ceremony_label, works_json, portrayals_json
         FROM doc.award_person_display WHERE person_tmdb_id = ? ORDER BY ceremony_year DESC LIMIT 100`,
		[personId],
		{ timeoutMs: 1000 },
	)
	return { awards: summarizePersonAwards(rows) ?? null }
}

/** A failed or late read is null (the page is then incomplete); a person without awards is undefined. */
export async function getPersonAwards(
	personId: number,
): Promise<PersonAwards | undefined | null> {
	const result = await optionalTitlePart(
		"person-awards",
		async () =>
			(
				await cached({
					name: "person-awards-v1",
					params: { personId },
					ttlMinutes: TTL_MINUTES,
					target: readPersonAwards,
				})
			).awards ?? undefined,
		1200,
	)
	return result.complete ? result.value : null
}
