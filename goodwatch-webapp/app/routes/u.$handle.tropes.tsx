// Member profile, Tropes tab: /u/:handle/tropes. The TV Tropes tropes in what the owner scores, ranked by how clearly
// they show up in what they score 8 or more, each opening to its description, numbers, defining titles and their
// excerpts (from /u/:handle/tropes/excerpts). The tab needs both the taste and the scores to be visible.
// Spec: docs/implementation/taste-redesign.md, decision 3.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { type ProfileShell, seesPart } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { profileLoader } from "~/server/profile/route.server"
import {
	type ProfileTropes,
	loadProfileTropes,
} from "~/server/profile/tropes.server"
import { WRAP } from "~/ui/my-pages/bits"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body, TILE, count } from "~/ui/profile/parts"
import { TropesPage } from "~/ui/profile/tropes/TropesPage"
import { tropesLine } from "~/ui/profile/tropes/model"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	tropes: ProfileTropes | null
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(args, async ({ ownerId, viewerId, shell }) => ({
		tropes: await loadProfileTropes(ownerId, shell, viewerId),
	}))

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const d = data as Partial<Data> | undefined
	return profileMeta(
		d?.shell,
		"tropes",
		d?.shell && d.tropes ? tropesLine(d.shell.handle, d.tropes) : undefined,
	)
}

export default function ProfileTropesTab() {
	const { shell, tropes } = useLoaderData() as Data
	const owner = shell.viewer === "owner"
	const carrying = tropes?.pool.filter((t) => t.r.length > 0).length ?? 0
	const ready = !!tropes?.tropes.length
	return (
		<ProfileFrame
			shell={shell}
			tab="tropes"
			// The tab shows scores and the titles that carry them: both parts must be visible.
			part={seesPart(shell, "taste") ? "scores" : "taste"}
			title="Tropes"
			line={
				tropes && ready
					? `${count(tropes.tropes.length)} tropes across ${count(carrying)} of ${owner ? "your" : "their"} titles`
					: undefined
			}
		>
			{tropes && ready ? (
				<div className={`${WRAP} pt-6 pb-40 text-white`}>
					<TropesPage shell={shell} data={tropes} />
				</div>
			) : (
				<Body>
					<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
						{owner
							? "Your tropes show up here once you've scored more titles."
							: `@${shell.handle} hasn't scored enough titles for tropes yet.`}
					</p>
				</Body>
			)}
		</ProfileFrame>
	)
}
