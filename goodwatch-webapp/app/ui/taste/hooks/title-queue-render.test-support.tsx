import { renderToString } from "react-dom/server"
import { LocaleContext } from "~/utils/locale"
import type { ScoringMedia } from "~/ui/scoring/types"
import { useTitleQueue } from "./useTitleQueue"

const title = (id: number): ScoringMedia => ({
	tmdb_id: id,
	media_type: "movie",
	title: `Title ${id}`,
	poster_path: "/poster.jpg",
})
const titles = [title(1), title(2), title(2), title(3)]
const fetchMoreTitles = async () => []
function Queue({
	answered = false,
	empty = false,
	resume = false,
}: { answered?: boolean; empty?: boolean; resume?: boolean }) {
	const q = useTitleQueue({
		initialTitles: empty ? [] : titles,
		interactions: answered
			? [{ media_type: "movie", tmdb_id: 1, type: "skip", timestamp: 0 }]
			: [],
		answeredKeys: answered ? new Set(["movie-2"]) : undefined,
		isAuthenticated: answered,
		fetchMoreTitles,
		resume,
	})
	return (
		<output>
			{JSON.stringify({
				current: q.current?.tmdb_id ?? null,
				next: q.next?.tmdb_id ?? null,
				count: q.queueLength,
				loading: q.isLoading,
			})}
		</output>
	)
}
const draw = (props = {}, language = "en") =>
	renderToString(
		<LocaleContext.Provider value={{ locale: { country: "US", language } }}>
			<Queue {...props} />
		</LocaleContext.Provider>,
	)
console.log(
	"__TITLE_QUEUE__" +
		JSON.stringify({
			first: draw(),
			answered: draw({ answered: true }),
			empty: draw({ empty: true }),
			language: draw({}, "de"),
			resume: draw({ resume: true }),
		}),
)
