import { START_AFTER_PAINT } from "~/utils/start-after-paint"
// Scores › Scored: /u/:handle/scores. The owner gets every score in one table, to change any of them in place. Visitors
// (and the owner with ?as=visitor) get every public score, grouped by tier.
// Spec: docs/implementation/member-profile/README.md
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { ScoredTitle } from "~/domain/my-scores"
import type { ProfileScoresPage, ProfileShell } from "~/domain/profile"
import { scoresChoiceOf } from "~/domain/profile-scores"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMyScores } from "~/server/my-scores.server"
import {
	loadProfileShell,
	profileCacheControl,
} from "~/server/profile/page.server"
import { loadProfileScoreView } from "~/server/profile/scores.server"
import { MyScoresPage } from "~/ui/my-library/scores/MyScoresPage"
import { profileMeta } from "~/ui/profile/meta"
import { Body } from "~/ui/profile/parts"
import { ScoresPage } from "~/ui/profile/pages/ScoresPage"

export { pageHeaders as headers } from "~/utils/headers"

type Data =
	| { view: "owner"; shell: ProfileShell; titles: ScoredTitle[] }
	| {
			view: "visitor"
			shell: ProfileShell
			page: ProfileScoresPage
			revision: string
			viewerKey: string | null
			you: Record<string, number> | null
	  }

const load = async ({ request, params }: LoaderFunctionArgs) => {
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const { ownerId, viewerId, shell } = loaded
	const headers = { "Cache-Control": profileCacheControl(viewerId) }
	if (shell.viewer === "owner")
		return json<Data>(
			{ view: "owner", shell, titles: await getMyScores(ownerId) },
			{ headers },
		)
	const view = await loadProfileScoreView(
		ownerId,
		viewerId,
		shell,
		scoresChoiceOf(new URL(request.url).searchParams),
	)
	return json<Data>({ view: "visitor", shell, ...view }, { headers })
}

export const loader = presentCatalogLoader(load, { live: true })

// The owner's table keeps the scores it changed itself: reading the list again after a save would undo where rescored
// rows sit. A new query (the visitor's kind and sort, ?as=visitor) and a plain revalidation still read it again.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	formMethod && currentUrl.href === nextUrl.href
		? false
		: defaultShouldRevalidate

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	profileMeta((data as Partial<Data> | undefined)?.shell, "scores")

export default function ProfileScored() {
	const data = useLoaderData() as Data
	if (data.view === "owner") return <MyScoresPage titles={data.titles} />
	return (
		<Body>
			<ScoresPage
				shell={data.shell}
				page={data.page}
				you={data.you}
				viewerKey={data.viewerKey}
				revision={data.revision}
			/>
		</Body>
	)
}

// The complete server document paints before route modules compete for bandwidth.
export const handle = START_AFTER_PAINT
