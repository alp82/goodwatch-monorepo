import type { TastePerson, TasteStats } from "../../domain/profile-taste.ts"
// The Taste tab's numbers cut to what the viewer may see. The numbers are computed and cached once per owner
// (taste-stats.server.ts); every view passes through here, so a part the owner hides never reaches the page through
// its stats: no scores or averages without Scores, no facts about watched titles without Seen, no episodes without
// Shows and time watched.
import type { ProfileTitle } from "../../domain/profile.ts"

/** Which of the owner's parts the viewer may see. */
export interface StatsSight {
	scores: boolean
	seen: boolean
	shows: boolean
	hours: boolean
}

const unscored = <T extends ProfileTitle>(title: T): T => ({
	...title,
	score: null,
})

export function statsForViewer(
	stats: TasteStats,
	sight: StatsSight,
): TasteStats {
	const { scores, seen, shows, hours } = sight
	const person = (p: TastePerson): TastePerson => ({
		...p,
		average: scores ? p.average : null,
		hours: hours ? p.hours : null,
		titles: scores ? p.titles : p.titles.map(unscored),
	})
	const people = stats.people
	const facts =
		seen && stats.facts
			? {
					...stats.facts,
					longest:
						stats.facts.longest &&
						(scores ? stats.facts.longest : unscored(stats.facts.longest)),
					shortest:
						stats.facts.shortest &&
						(scores ? stats.facts.shortest : unscored(stats.facts.shortest)),
					oldest:
						stats.facts.oldest &&
						(scores ? stats.facts.oldest : unscored(stats.facts.oldest)),
					newest:
						stats.facts.newest &&
						(scores ? stats.facts.newest : unscored(stats.facts.newest)),
					mostEpisodes:
						shows && hours && stats.facts.mostEpisodes
							? scores
								? stats.facts.mostEpisodes
								: unscored(stats.facts.mostEpisodes)
							: null,
				}
			: null
	const badges = stats.badges
		.filter((b) => (b.id !== "style" || scores) && (b.id !== "plates" || shows))
		// "18 anime rated, averaging 7.9": the average is a score.
		.map((b) =>
			b.id === "anime" && !scores
				? { ...b, line: b.line.replace(/, averaging [\d.]+$/, "") }
				: b,
		)
	return {
		genres: stats.genres.map((g) => ({
			...g,
			average: scores ? g.average : null,
		})),
		people: {
			directors: people.directors.map(person),
			// Ranked by the owner's scores: an order that shows them.
			bestDirectors: scores ? people.bestDirectors.map(person) : [],
			actors: people.actors.map(person),
			composers: people.composers.map(person),
			writers: people.writers.map(person),
		},
		eras: {
			...stats.eras,
			// Best rated first is an order that shows the scores: without them, the panel goes by the GoodWatch score.
			decades: stats.eras.decades.map((d) => ({
				...d,
				average: scores ? d.average : null,
				titles: scores ? d.titles : d.byCrowd.map(unscored),
				byCrowd: [],
			})),
			// Classics are the owner's 9s and 10s: the list itself says how they scored them.
			classics: scores ? stats.eras.classics : [],
		},
		world: {
			...stats.world,
			countries: stats.world.countries.map((c) => ({
				...c,
				average: scores ? c.average : null,
			})),
		},
		tags: {
			// Essence tags come from the titles scored 8 or more, so they keep only their counts.
			essence: stats.tags.essence.map((t) => ({
				...t,
				average: scores ? t.average : null,
			})),
			tropes: stats.tags.tropes,
		},
		facts,
		style: scores ? stats.style : null,
		badges,
	}
}
