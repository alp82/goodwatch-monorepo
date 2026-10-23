// Member profile, Taste tab: /u/:handle/taste. The owner's taste portrait as the public sees it (viewer type,
// fingerprint, sides, the crowd), their taste numbers, and for a signed-in visitor the comparison with their own taste.
// The owner's private taste tools stay on /taste.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { type ProfileShell, seesPart } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMemberCompare } from "~/server/profile/compare.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { profileLoader } from "~/server/profile/route.server"
import { statsForViewer } from "~/server/profile/taste-stats-view"
import { getTasteStats } from "~/server/profile/taste-stats.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { TastePage } from "~/ui/profile/pages/TastePage"
import type { NamedTasteStats } from "~/ui/profile/taste/Stats"
import {
	type ProfileTaste,
	buildProfileTaste,
	theirLine,
} from "~/ui/profile/taste/model"
import { languageName, regionName } from "~/utils/display-names"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	taste: ProfileTaste | null
	stats: NamedTasteStats | null
	compare: MemberCompare | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(
		args,
		async ({ ownerId, viewerId, shell }): Promise<Omit<Data, "shell">> => {
			if (!seesPart(shell, "taste"))
				return { taste: null, stats: null, compare: null }
			const scores = seesPart(shell, "scores")
			// A part that fails to load is left out; the page still renders.
			const orNull = <T,>(work: Promise<T>, what: string) =>
				work.catch((error) => {
					console.error(`[profile] taste tab: ${what} failed`, error)
					return null
				})
			const [fingerprint, sides, everyone, raw, compare] = await Promise.all([
				orNull(
					getProfilePortrait(ownerId, "fingerprint", { scores }),
					"fingerprint",
				),
				orNull(getProfilePortrait(ownerId, "sides", { scores }), "sides"),
				orNull(getProfilePortrait(ownerId, "everyone", { scores }), "crowd"),
				orNull(getTasteStats(ownerId), "stats"),
				shell.viewer === "member"
					? orNull(
							getMemberCompare(viewerId, ownerId, shell.visibility),
							"compare",
						)
					: null,
			])
			// The numbers are the owner's in full; cut them to the parts this viewer may see.
			const stats =
				raw &&
				statsForViewer(raw, {
					scores,
					seen: seesPart(shell, "seen"),
					shows: seesPart(shell, "shows"),
					hours: seesPart(shell, "hours"),
				})
			// Names for the codes here, so the server's and the browser's name tables can't disagree on hydration.
			const named: NamedTasteStats | null = stats && {
				...stats,
				world: {
					...stats.world,
					countries: stats.world.countries.map((c) => ({
						...c,
						name: regionName(c.code),
					})),
					languages: stats.world.languages.map((l) => ({
						...l,
						name: languageName(l.code),
					})),
				},
			}
			const taste =
				fingerprint && sides && everyone
					? buildProfileTaste(fingerprint, sides, everyone)
					: null
			return { taste, stats: named, compare }
		},
	)

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const d = data as Partial<Data> | undefined
	const t = d?.taste
	return profileMeta(
		d?.shell,
		"taste",
		t?.identity
			? `@${d?.shell?.handle}'s viewer type: ${t.identity.name}. ${theirLine(t.line)}`
			: undefined,
	)
}

export default function ProfileTasteTab() {
	const { shell, taste, stats, compare } = useLoaderData() as Data
	return (
		<ProfileFrame
			shell={shell}
			tab="taste"
			part="taste"
			title="Taste"
			line={
				taste?.identity
					? `${taste.identity.name} · read from ${taste.counted.toLocaleString("en-US")} scores`
					: undefined
			}
		>
			{taste && (
				<TastePage
					shell={shell}
					taste={taste}
					stats={stats}
					compare={compare}
				/>
			)}
		</ProfileFrame>
	)
}
