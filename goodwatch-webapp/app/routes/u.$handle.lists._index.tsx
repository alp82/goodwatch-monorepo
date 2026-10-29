// Member profile, Lists tab: /u/:handle/lists. Their share lists, newest first; for the owner this is also My lists
// (unlisted lists too, with Edit, Share, Delete and the Public or Unlisted switch). Each list keeps its own page at
// /u/:handle/lists/:id.
// Spec: docs/implementation/member-profile/README.md
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ProfileListsPage, ProfileShell } from "~/domain/profile"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileLists } from "~/server/profile/page.server"
import { profileLoader } from "~/server/profile/route.server"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import { profileMeta } from "~/ui/profile/meta"
import { Body } from "~/ui/profile/parts"
import { ListsPage } from "~/ui/profile/pages/ListsPage"

export { pageHeaders as headers } from "~/utils/headers"

interface Data {
	shell: ProfileShell
	page: ProfileListsPage
}

const load = (args: LoaderFunctionArgs) =>
	profileLoader(
		args,
		async ({ ownerId, shell }) => ({
			page: await loadProfileLists(ownerId, shell),
		}),
		{ listCards: true },
	)

export const loader = presentCatalogLoader(load, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	profileMeta((data as Partial<Data> | undefined)?.shell, "lists")

export default function ProfileLists() {
	const { shell, page } = useLoaderData() as Data
	return (
		<ProfileFrame
			shell={shell}
			tab="lists"
			part="lists"
			title="Lists"
			line="Top 5 lists, ranked."
		>
			<Body>
				<ListsPage shell={shell} lists={page.lists} />
			</Body>
		</ProfileFrame>
	)
}
