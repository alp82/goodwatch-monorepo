import { query } from "~/utils/crate"
import {
	type PersonAwardRow,
	type PersonAwards,
	summarizePersonAwards,
} from "./person-awards.ts"
import { optionalTitlePart } from "./title-page-budget.ts"

export async function getPersonAwards(
	personId: number,
): Promise<PersonAwards | undefined | null> {
	const result = await optionalTitlePart(
		"person-awards",
		async (signal) =>
			summarizePersonAwards(
				await query<PersonAwardRow>(
					`SELECT result_id, award_name, category_name, ceremony_year, has_win, has_nomination, source_names, reference_urls, ceremony_label, works_json, portrayals_json
         FROM doc.award_person_display WHERE person_tmdb_id = ? ORDER BY ceremony_year DESC LIMIT 100`,
					[personId],
					{ signal, timeoutMs: 1000 },
				),
			),
		1200,
	)
	return result.complete ? result.value : null
}
