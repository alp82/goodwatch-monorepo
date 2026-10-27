import { renderToStaticMarkup } from "react-dom/server"
import { episodeLayoutOf } from "~/domain/tracking/episode-layout"
import chernobyl from "~/ui/prototype-episode-list/fixtures/chernobyl.json"
import sherlock from "~/ui/prototype-episode-list/fixtures/sherlock.json"
import slowHorses from "~/ui/prototype-episode-list/fixtures/slow-horses.json"
import supernatural from "~/ui/prototype-episode-list/fixtures/supernatural.json"
import EpisodeSkeleton from "./EpisodeSkeleton"

console.log(
	JSON.stringify(
		Object.fromEntries(
			Object.entries({
				chernobyl,
				sherlock,
				"slow-horses": slowHorses,
				supernatural,
			}).map(([name, show]) => {
				const layout = episodeLayoutOf(
					show.seasons.flatMap((season) =>
						season.episodes.map(() => ({ season: season.number })),
					),
				)
				return [name, renderToStaticMarkup(<EpisodeSkeleton layout={layout} />)]
			}),
		),
	),
)
