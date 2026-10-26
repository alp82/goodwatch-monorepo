// Member profile, Tropes tab: /u/:handle/tropes. The TV Tropes tropes in what the owner scores, ranked by how clearly
// they show up in what they score 8 or more, each opening to its description, numbers, defining titles and their
// excerpts (from /u/:handle/tropes/excerpts). The tab needs both the taste and the scores to be visible.
// Spec: docs/implementation/taste-redesign.md, decision 3.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { protectMediaResponse } from "~/server/media-read-health.server"
import {
	loadProfileShell,
	profileCacheControl,
} from "~/server/profile/page.server"
import { readTropeDescriptions } from "~/server/profile/trope-catalog.server"
import { seesTropes } from "~/server/profile/tropes-model"
import {
	tropesPreview,
	withPreviewDescriptions,
} from "~/server/profile/tropes-preview"
import { loadProfileTropes } from "~/server/profile/tropes.server"
import { profileMeta } from "~/ui/profile/meta"
import { tropesLine } from "~/ui/profile/tropes/model"

import {
	type TropesTabProps as Data,
	TropesTab,
} from "~/ui/profile/tropes/TropesTab"

export { pageHeaders as headers } from "~/utils/headers"

// Only the first bands cross the document boundary. Full filtering data has its own private resource route.
const present = presentCatalogLoader(
	async (args: LoaderFunctionArgs) => {
		const loaded = await loadProfileShell(
			args.request,
			args.params.handle ?? "",
		)
		if (loaded instanceof Response) return loaded
		const { ownerId, viewerId, shell } = loaded
		const full = await loadProfileTropes(ownerId, shell, viewerId, {
			wait: false,
			descriptions: false,
		})
		const preview = full ? tropesPreview(full) : null
		const descriptions = preview
			? await readTropeDescriptions(preview.ranked.map((t) => t.id ?? t.name))
			: {}
		return {
			shell,
			preview: preview ? withPreviewDescriptions(preview, descriptions) : null,
			pending: seesTropes(shell) && !full,
			cacheControl: profileCacheControl(viewerId),
		}
	},
	{ live: true },
)

export async function loader(args: LoaderFunctionArgs) {
	const result = await present(args)
	if (result instanceof Response) return result
	const { cacheControl, ...data } = result
	const headers = new Headers({
		"Cache-Control": data.pending ? "private, no-store" : cacheControl,
	})
	// A failed or still-pending catalog read keeps the page out of shared caches, as for a JSON response.
	protectMediaResponse(headers, result)
	return json<Data>(data, { headers })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const d = data as Partial<Data> | undefined
	return profileMeta(
		d?.shell,
		"tropes",
		d?.shell && d.preview ? tropesLine(d.shell.handle, d.preview) : undefined,
	)
}

export default function ProfileTropesTab() {
	return <TropesTab {...useLoaderData<Data>()} />
}
