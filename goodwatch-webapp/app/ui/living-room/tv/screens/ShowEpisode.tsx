// The Next episode of a member's show on the title screen: which episode Seen it marks, and the mark itself
// (use-tv-episode.ts). It draws nothing and reports up to the scene, as every screen's data does ("How a screen
// loads its data", docs/implementation/tv-screen-revamp/tonight-title). A chunk of its own (screen-code.tsx): it
// brings the show page's tracking code, which only a member on a show's title screen needs.
//
// A show's tracking is read only when the member's data says the show can have an episode to mark, which is a
// Watching or a Seen show: a show the member has not started, has on hold or has dropped costs no request.
import { useWatchState } from "~/hooks/useUserDataAccessors"
import { useUser } from "~/utils/auth"
import { useReport } from "../kit"
import { mayHaveNext } from "../tv-shows"
import { parseTvTitleKey } from "../tv-title"
import { type TvEpisodeReport, useTvEpisode } from "../use-tv-episode"

type Props = Omit<Parameters<typeof useTvEpisode>[0], "showId"> & {
	report: (episode: TvEpisodeReport | null) => void
}

function Tracked({ report, ...on }: Props & { showId: number }) {
	useReport(report, useTvEpisode(on))
	return null
}

export default function EpisodeData(props: Props) {
	const show = parseTvTitleKey(props.title)
	const { user } = useUser()
	const state = useWatchState("show", show?.tmdbId ?? 0)?.state
	if (!show || show.mediaType !== "show" || !user) return null
	if (!mayHaveNext(state)) return null
	// A key per show: another show is another store and another report.
	return <Tracked key={show.tmdbId} {...props} showId={show.tmdbId} />
}
