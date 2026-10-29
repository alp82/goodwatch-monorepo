// Member profile: /u/:handle, the Overview. Who the member is (picture, @handle, since, bio, links), the stat strip, the
// profile's tabs, and the Overview's parts, each as the owner lets the viewer see it. Handles are permanent: a
// differently cased handle redirects to the lowercase one, unknown and deleted handles answer 404.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type ProfileOverview,
	type ProfileShell,
	seesPart,
} from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMemberCompare } from "~/server/profile/compare.server"
import { loadProfileOverview } from "~/server/profile/page.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { profileLoader } from "~/server/profile/route.server"
import { Overview, type OverviewTaste } from "~/ui/profile/Overview"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"

export { pageHeaders as headers } from "~/utils/headers"

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => {
		// The taste card and the comparison are extras: when one fails, the Overview renders without it. The match shows
		// whatever the owner's Taste setting (Q9); without Taste the comparison carries no pulls.
		const orNull = <T,>(work: Promise<T>, what: string) =>
			work.catch((error) => {
				console.error(`[profile] overview: ${what} failed`, error)
				return null
			})
		const [overview, fingerprint, compare] = await Promise.all([
			loadProfileOverview(ownerId, shell),
			seesPart(shell, "taste")
				? orNull(
						getProfilePortrait(ownerId, "fingerprint", {
							scores: seesPart(shell, "scores"),
						}),
						"fingerprint",
					)
				: null,
			shell.viewer === "member"
				? orNull(
						getMemberCompare(viewerId, ownerId, shell.visibility),
						"compare",
					)
				: null,
		])
		const taste: OverviewTaste | null =
			fingerprint && fingerprint.status === "ready"
				? {
						identity: fingerprint.identity?.name ?? null,
						line: fingerprint.line,
						avoid: fingerprint.avoid,
						attributes: fingerprint.attributes.map((a) => ({
							key: a.key,
							label: a.label,
							family: a.family,
							edge: a.edge,
						})),
					}
				: null
		return { overview, taste, compare }
	}, { listCards: true })

export const loader = presentCatalogLoader(load, { live: true })

/** The loader's JSON (a redirect never renders). */
interface OverviewData {
	shell: ProfileShell
	overview: ProfileOverview
	taste: OverviewTaste | null
	compare: MemberCompare | null
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const d = data as Partial<OverviewData> | undefined
	const viewerType = d?.taste?.identity
	return profileMeta(
		d?.shell,
		"overview",
		d?.shell?.bio ||
			(viewerType
				? `@${d?.shell?.handle} on GoodWatch. Viewer type: ${viewerType}.`
				: undefined),
	)
}

export default function ProfileOverviewPage() {
	const { shell, overview, taste, compare } = useLoaderData() as OverviewData
	return (
		<ProfileFrame
			shell={shell}
			tab="overview"
			posters={{
				wishlist: overview.newestWishlist.map((t) => t.poster),
				lists: overview.lists.map((l) => l.posters[0] ?? null),
			}}
		>
			<Overview
				shell={shell}
				overview={overview}
				taste={taste}
				compare={compare}
			/>
		</ProfileFrame>
	)
}
