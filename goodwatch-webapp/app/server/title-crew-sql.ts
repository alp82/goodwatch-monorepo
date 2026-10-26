import { CREW_ROLES } from "../ui/details/crew-roles.ts"

export type CrewRole = keyof typeof CREW_ROLES

/** The rows used by every rendering of a title's crew line. */
export function selectedCrewRows(role: CrewRole): string {
	const { jobs, department } = CREW_ROLES[role]
	const exactJob = `job IN (${jobs.map((job) => `'${job}'`).join(", ")})`
	// Aggregate show credits can have no department. Match jobs independently of it.
	// Collapse multiple accepted jobs for one person before applying the line's limit.
	return `SELECT id, credit_id, name, episode_count_total, popularity FROM (
 SELECT id, min(credit_id) AS credit_id, name,
   max(episode_count_total) AS episode_count_total, max(popularity) AS popularity FROM crew_rows
 WHERE ${exactJob} OR (department = '${department}' AND
   (SELECT count(*) FROM crew_rows WHERE ${exactJob}) = 0)
 GROUP BY id, name
 ) AS people
 ORDER BY episode_count_total DESC NULLS LAST, popularity DESC NULLS LAST,
   credit_id ASC NULLS LAST, id ASC, name ASC LIMIT 3`
}

export const selectedCrewCTEs = Object.keys(CREW_ROLES)
	.map(
		(role) =>
			`selected_crew_${role} AS (${selectedCrewRows(role as CrewRole)})`,
	)
	.join(",\n")

export const crewPeople = (role: CrewRole) =>
	`ARRAY(SELECT {id = id, credit_id = credit_id, name = name} FROM selected_crew_${role}
 ORDER BY episode_count_total DESC NULLS LAST, popularity DESC NULLS LAST,
   credit_id ASC NULLS LAST, id ASC, name ASC)`
