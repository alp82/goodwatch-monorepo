// The hub previews are decorative posters and small place cards. The title key identifies the artwork for
// localization. Only the Top lists link to individual titles and show their year and genres.
import type { ShowTitle, TraitWord } from "~/domain/browse/types"
import type { MiniData, MiniPlace } from "./hub.server"

const words = (traits: TraitWord[]) => traits.map(({ key, word, color }) => ({ key, word, color }))
const posters = (titles: ShowTitle[]) =>
	titles.map(({ card: { key, title, poster_path } }) => ({ card: { key, title, poster_path } }))

const summary = ({ place, copy, traits, tropes }: MiniPlace) => ({
	place,
	copy: copy ? { short: copy.short } : null,
	traits: words(traits),
	tropes,
})

export function hubViewData(data: MiniData) {
	return {
		lede: data.lede,
		moodStart: data.moodStart,
		moods: data.moods.map((m) => ({
			...summary(m),
			titles: posters(m.titles),
			tone: m.tone,
			pace: m.pace,
		})),
		decades: data.decades.map((d) => ({
			...summary(d),
			titles: posters(d.titles),
			...(d.rose && { rose: d.rose }),
		})),
		countries: data.countries.map((c) => ({ ...summary(c), titles: posters(c.titles) })),
		mapped: data.mapped,
		genres: data.genres.map((g) => ({
			...summary(g),
			kindsOf: g.kindsOf.map(({ id, name, traits, titles }) => ({
				id,
				name,
				traits: words(traits),
				titles: posters(titles),
			})),
		})),
		streamingReady: data.streamingReady,
		services: data.services.map(({ place, count, titles }) => ({
			place,
			count,
			titles: posters(titles),
		})),
		lists: data.lists.map(({ id, q, key, parts, rows }) => ({
			id,
			q,
			key,
			parts,
			rows: rows.map(
				({
					genres,
					title: {
						to,
						card: { key, title, poster_path, release_year },
					},
				}) => ({
					title: { to, card: { key, title, poster_path, release_year } },
					genres: genres.slice(0, 2),
				}),
			),
		})),
		occasions: data.occasions.map(({ name, line, parts, titles }) => ({
			name,
			line,
			parts,
			titles: posters(titles),
		})),
	}
}

export type HubViewData = ReturnType<typeof hubViewData>
