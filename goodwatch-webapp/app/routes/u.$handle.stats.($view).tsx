// Member profile, Stats tab: /u/:handle/stats. The summary of the owner's taste as the public sees it (viewer type,
// print, taste groups, against everyone), their taste numbers, and for a signed-in visitor the comparison with their own
// taste. /u/:handle/stats/everyone and /stats/sides are the same page with that section's share card as the link
// preview. The owner's own taste page is /taste. The tab was Taste at /u/:handle/taste, which redirects here.
// Spec: docs/implementation/member-profile/README.md, docs/implementation/taste-redesign.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { type ProfileShell, seesPart } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMemberCompare } from "~/server/profile/compare.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { profileLoader } from "~/server/profile/route.server"
import { statsPayload, statsTastePayload } from "~/server/profile/stats-payload"
import { statsForViewer } from "~/server/profile/taste-stats-view"
import { getTasteStats } from "~/server/profile/taste-stats.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { StatsPage } from "~/ui/profile/pages/StatsPage"
import { ShareMenu } from "~/ui/profile/taste/ShareMenu"
import { PROFILE_CARD_VIEWS } from "~/ui/og-image/profile-card-model"
import type { NamedTasteStats } from "~/ui/profile/taste/Stats"
import {
	type ProfileTaste,
	buildProfileTaste,
	theirLine,
} from "~/ui/profile/taste/model"
import { timeRequestWork } from "~/utils/request-work"
import { languageName, regionName } from "~/utils/display-names"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	taste: ProfileTaste | null
	stats: NamedTasteStats | null
	compare: MemberCompare | null
}

const load = (args: LoaderFunctionArgs) => {
	const view = args.params.view
	if (view && !PROFILE_CARD_VIEWS.some((v) => v === view))
		throw new Response("Not found", { status: 404 })
	return profileLoader(
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
					timeRequestWork(args.request, "portrait_fingerprint", () =>
						getProfilePortrait(ownerId, "fingerprint", {
							scores,
							summary: true,
							request: args.request,
						}),
					),
					"fingerprint",
				),
				orNull(
					timeRequestWork(args.request, "portrait_sides", () =>
						getProfilePortrait(ownerId, "sides", {
							scores,
							summary: true,
							request: args.request,
						}),
					),
					"sides",
				),
				orNull(
					timeRequestWork(args.request, "portrait_everyone", () =>
						getProfilePortrait(ownerId, "everyone", {
							scores,
							summary: true,
							request: args.request,
						}),
					),
					"crowd",
				),
				orNull(getTasteStats(ownerId, args.request), "stats"),
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
				...statsPayload(stats),
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
					? statsTastePayload(buildProfileTaste(fingerprint, sides, everyone))
					: null
			return { taste, stats: named, compare }
		},
	)
}

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const d = data as Partial<Data> | undefined
	const t = d?.taste
	return profileMeta(
		d?.shell,
		"stats",
		t?.identity
			? `@${d?.shell?.handle}'s viewer type: ${t.identity.name}. ${theirLine(t.line)}`
			: undefined,
		params.view,
	)
}

export default function ProfileStatsTab() {
	const { shell, taste, stats, compare } = useLoaderData() as Data
	return (
		<ProfileFrame
			shell={shell}
			tab="stats"
			part="taste"
			title="Stats"
			line={
				taste?.status === "ready"
					? `${taste.counted.toLocaleString("en-US")} scores`
					: undefined
			}
			headerRight={
				taste?.status === "ready" ? <ShareMenu shell={shell} /> : undefined
			}
		>
			{taste && (
				<StatsPage
					shell={shell}
					taste={taste}
					stats={stats}
					compare={compare}
				/>
			)}
		</ProfileFrame>
	)
}
