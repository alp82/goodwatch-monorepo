// The Taste profile tab: /u/:handle. The owner gets their own taste page (the portrait, or the start while their taste
// forms). Everyone else, and the owner with ?as=visitor, gets the public portrait: who they are (bio, links, since),
// the summary of their taste, the taste match, their 10s and their hot takes, each as the owner lets them see it.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type ProfileOverview,
	type ProfileShell,
	seesPart,
} from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMemberCompare } from "~/server/profile/compare.server"
import {
	loadProfileOverview,
	loadProfileShell,
	profileCacheControl,
} from "~/server/profile/page.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { statsTastePayload } from "~/server/profile/stats-payload"
import {
	type TastePageData,
	readTastePage,
} from "~/server/taste-portrait/page.server"
import type { OverviewTaste } from "~/ui/profile/Overview"
import { profileMeta } from "~/ui/profile/meta"
import { TasteProfilePage } from "~/ui/profile/pages/TasteProfilePage"
import { type ProfileTaste, buildProfileTaste } from "~/ui/profile/taste/model"
import {
	TastePageBody,
	sideShouldRevalidate,
} from "~/ui/taste/portrait/TastePageBody"

export { pageHeaders as headers } from "~/utils/headers"

interface OwnerData {
	view: "owner"
	shell: ProfileShell
	page: TastePageData
	viewerType: string | null
}

interface VisitorData {
	view: "visitor"
	shell: ProfileShell
	taste: ProfileTaste | null
	overviewTaste: OverviewTaste | null
	overview: ProfileOverview
	compare: MemberCompare | null
}

type Data = OwnerData | VisitorData

const load = async ({ request, params }: LoaderFunctionArgs) => {
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const { ownerId, viewerId, shell } = loaded
	const headers = { "Cache-Control": profileCacheControl(viewerId) }
	if (shell.viewer === "owner") {
		const page = await readTastePage(request, ownerId)
		return json<Data>(
			{
				view: "owner",
				shell,
				page,
				viewerType:
					page.kind === "portrait" ? (page.taste.identity?.name ?? null) : null,
			},
			{ headers },
		)
	}
	// The portrait and the comparison are extras: when one fails, the tab renders without it.
	const orNull = <T,>(work: Promise<T>, what: string) =>
		work.catch((error) => {
			console.error(`[profile] taste profile: ${what} failed`, error)
			return null
		})
	const taste = seesPart(shell, "taste")
	const portrait = <T extends "fingerprint" | "sides" | "everyone">(tab: T) =>
		taste
			? orNull(
					getProfilePortrait(ownerId, tab, {
						scores: seesPart(shell, "scores"),
						summary: true,
						request,
					}),
					tab,
				)
			: Promise.resolve(null)
	const [overview, fingerprint, sides, everyone, compare] = await Promise.all([
		loadProfileOverview(ownerId, shell, { highlights: true }),
		portrait("fingerprint"),
		portrait("sides"),
		portrait("everyone"),
		shell.viewer === "member"
			? orNull(
					getMemberCompare(viewerId, ownerId, shell.visibility),
					"compare",
				)
			: null,
	])
	const built =
		fingerprint && sides && everyone
			? statsTastePayload(buildProfileTaste(fingerprint, sides, everyone))
			: null
	const overviewTaste: OverviewTaste | null =
		fingerprint?.status === "ready"
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
	return json<Data>(
		{
			view: "visitor",
			shell,
			taste: built,
			overviewTaste,
			overview,
			compare,
		},
		{ headers },
	)
}

export const loader = presentCatalogLoader(load, { live: true })

// A taste group in the address (`?side=`) alone keeps the data.
export const shouldRevalidate = sideShouldRevalidate

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const d = data as Partial<Data> | undefined
	const viewerType =
		d?.view === "owner"
			? d.viewerType
			: d?.view === "visitor"
				? d.overviewTaste?.identity
				: null
	return profileMeta(
		d?.shell,
		"overview",
		d?.shell?.bio ||
			(viewerType
				? `@${d?.shell?.handle} on GoodWatch. Viewer type: ${viewerType}.`
				: undefined),
	)
}

export default function ProfileTasteTab() {
	const data = useLoaderData() as Data
	if (data.view === "owner") return <TastePageBody data={data.page} />
	return (
		<TasteProfilePage
			shell={data.shell}
			taste={data.taste}
			overview={data.overview}
			overviewTaste={data.overviewTaste}
			compare={data.compare}
		/>
	)
}
