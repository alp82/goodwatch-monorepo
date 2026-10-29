import { START_AFTER_PAINT } from "~/utils/start-after-paint"
// Member profile, Scores tab: /u/:handle/scores. Every score, grouped by tier.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileShell, ProfileScoresPage } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { scoresChoiceOf } from "~/domain/profile-scores"
import { loadProfileScoreView } from "~/server/profile/scores.server"
import { profileLoader } from "~/server/profile/route.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body, count } from "~/ui/profile/parts"
import { ScoresPage } from "~/ui/profile/pages/ScoresPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileScoresPage
	revision: string
	viewerKey: string | null
	you: Record<string, number> | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => {
		return loadProfileScoreView(
			ownerId,
			viewerId,
			shell,
			scoresChoiceOf(new URL(args.request.url).searchParams),
		)
	})

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	profileMeta((data as Partial<Data> | undefined)?.shell, "scores")

export default function ProfileScores() {
	const { shell, page, you, viewerKey, revision } = useLoaderData() as Data
	return (
		<ProfileFrame
			shell={shell}
			tab="scores"
			part="scores"
			title="Scores"
			line={`${count(shell.counts.rated)} titles${shell.counts.average != null ? `, average ${shell.counts.average}` : ""}.`}
		>
			<Body>
				<ScoresPage
					shell={shell}
					page={page}
					you={you}
					viewerKey={viewerKey}
					revision={revision}
				/>
			</Body>
		</ProfileFrame>
	)
}

// The complete server document paints before route modules compete for bandwidth.
export const handle = START_AFTER_PAINT

// The first posters ask without credentials so Element Timing can report their paint.
export const links = () => [{ rel: "preconnect", href: "https://image.tmdb.org", crossOrigin: "anonymous" as const }]
