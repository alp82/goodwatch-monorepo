// My lists uses the existing profile when a handle exists. Private lists need no handle: a member without one gets
// their lists here, under the handle strip and the Profile row with Lists lit.
import { Link, useLoaderData, useLocation } from "@remix-run/react"
import { createMyListsPageLoader } from "~/server/share-lists/collection-page.server"
import {
	getProfileByUserId,
	listsByUser,
} from "~/server/share-lists/store.server"
import { NoHandleChrome } from "~/ui/profile/ProfileHeader"
import { getUserIdFromRequest } from "~/utils/auth"
export const loader = createMyListsPageLoader({
	getUserIdFromRequest,
	getProfileByUserId,
	listsByUser,
})
export { pageHeaders as headers } from "~/utils/headers"
export default function MyLists() {
	const { lists } = useLoaderData<typeof loader>()
	const { pathname, search } = useLocation()
	return (
		<>
			<NoHandleChrome pathname={pathname} search={search} />
			<main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-gray-100">
				<h1 className="text-3xl font-bold">My lists</h1>
				<p className="text-gray-400">
					Private lists are only visible to you until you share them.
				</p>
				<ul className="space-y-3">
					{lists.map((list) => (
						<li
							key={list.id}
							className="rounded-lg border border-slate-700 p-4"
						>
							<Link
								className="break-words text-lg font-semibold text-indigo-300 underline"
								to={`/lists/${list.id}`}
							>
								{list.title}
							</Link>
							<p className="text-gray-400">
								{list.count} titles · {list.visibility}
							</p>
						</li>
					))}
				</ul>
				<Link className="text-indigo-300 underline" to="/lists/new">
					Make a five-title share card
				</Link>
			</main>
		</>
	)
}
