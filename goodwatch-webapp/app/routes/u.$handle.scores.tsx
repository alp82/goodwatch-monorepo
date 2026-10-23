// Member profile, Scores tab: /u/:handle/scores. Every score, grouped by tier.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileShell, ProfileScoresPage } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileScores } from "~/server/profile/page.server"
import { profileLoader, visitorScores } from "~/server/profile/route.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body, count } from "~/ui/profile/parts"
import { ScoresPage } from "~/ui/profile/pages/ScoresPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileScoresPage
	you: Record<string, number> | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => {
		const page = await loadProfileScores(ownerId, shell)
		const you = await visitorScores(viewerId, shell, page.tiers.flatMap((t) => t.titles.map((x) => x.key)))
		return { page, you }
	})

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => profileMeta((data as Partial<Data> | undefined)?.shell, "scores")

export default function ProfileScores() {
	const { shell, page, you } = useLoaderData() as Data
	return (
		<ProfileFrame shell={shell} tab="scores" part="scores" title="Scores" line={`${count(shell.counts.rated)} titles${shell.counts.average != null ? `, average ${shell.counts.average}` : ""}.`}>
			<Body>
				<ScoresPage shell={shell} page={page} you={you} />
			</Body>
		</ProfileFrame>
	)
}
