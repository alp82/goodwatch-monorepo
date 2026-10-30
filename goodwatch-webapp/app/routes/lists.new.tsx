import { presentCatalogLoader } from "~/server/media-payload.server"
// The editor for a new share list, for guests and members without a handle: /lists/new. Members with a handle make
// theirs inside their profile, /u/:handle/lists/new (u.$handle.lists.new.tsx draws this page there), and are sent on.
// ?remix=<list id> starts from another list's prompt and titles.
// ?from=ratings starts from the person's highest-rated titles ("Share your top 5" on Taste): signed-in people's
// come from their ratings, guests send their ranked ratings as ?titles=movie:603,show:1399.
// A new list saves as a draft in this browser until it's shared; a visit that starts fresh doesn't restore it.
// ?share=1 is where sign-up and sign-in return to: it shares the restored draft (see ShareFlow).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData, useLocation, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import {
	prefillTitles,
	topRatedEntries,
} from "~/server/share-lists/prefill.server"
import { getRemixSource } from "~/server/share-lists/remix.server"
import {
	type ListEntry,
	getQuickPicks,
	parseTitleKey,
	resolveCardTitles,
} from "~/server/share-lists/titles.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { DEFAULT_DESIGN } from "~/ui/share-card/designs"
import {
	DEFAULT_PROMPT_ID,
	DEFAULT_THEME,
	GUEST_BYLINE,
	LIST_PROMPTS,
	cardDate,
	listByline,
} from "~/ui/share-card/model"
import { PREFILL_CANDIDATES, prefillPrompt } from "~/ui/share-card/prefill"
import { useShareFlow } from "~/ui/share-list-editor/ShareFlow"
import { ShareListEditor } from "~/ui/share-list-editor/ShareListEditor"
import { isComplete, readBrowserDraft } from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import { GUEST, member, moveResponse, oldToNew } from "~/domain/member-paths"
import { NoHandleChrome } from "~/ui/profile/ProfileHeader"
import { getUserIdFromRequest, useUser } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

/**
 * The editor fills the screen under the header. Here the Profile row sits above it too (sticky under the header), so
 * the editor is that much shorter: once the profile header scrolls away, the whole editor fits under the row.
 */
export const EDITOR_UNDER_ROW =
	"[&>div:first-child]:h-[calc(100dvh-4rem-49px)] max-lg:[&>div:first-child]:h-[calc(100dvh-8rem-45px)]"

const EMPTY_DRAFT: ListDraft = {
	title: LIST_PROMPTS[0].title,
	promptId: DEFAULT_PROMPT_ID,
	design: DEFAULT_DESIGN,
	theme: DEFAULT_THEME,
	items: [],
	remixedFrom: null,
}

// The rated titles a "Share your top 5" visit starts from, best first.
async function ratedEntries(
	params: URLSearchParams,
	userId: string | undefined,
): Promise<ListEntry[]> {
	if (userId) return topRatedEntries(userId)
	return (params.get("titles") ?? "")
		.split(",")
		.slice(0, PREFILL_CANDIDATES)
		.map(parseTitleKey)
		.filter((e): e is ListEntry => !!e)
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const remixId = params.get("remix")
	const fromRatings = !remixId && params.get("from") === "ratings"
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getCachedProfileByUserId(userId) : null
	// /lists/new with a handle, or someone else's /u/:handle/lists/new: on to the viewer's own editor.
	const url = new URL(request.url)
	const move = oldToNew(
		url.pathname,
		url.search,
		userId ? member(profile?.handle ?? null) : GUEST,
	)
	if (move) return moveResponse(move)
	const [quickPicks, source, rated] = await Promise.all([
		getQuickPicks(),
		remixId ? getRemixSource(remixId, userId) : null,
		fromRatings ? ratedEntries(params, userId).then(prefillTitles) : [],
	])
	// A remix is a new list with the source's prompt, titles, design, and colors, signed by the viewer.
	const initial: ListDraft = source
		? {
				title: source.title,
				promptId: source.promptId,
				design: source.design,
				theme: source.theme,
				items: await resolveCardTitles(source.items.slice(0, 5)),
				remixedFrom: source.id,
			}
		: rated.length
			? {
					...EMPTY_DRAFT,
					...prefillPrompt(rated.map((t) => t.type)),
					items: rated,
				}
			: EMPTY_DRAFT
	return json(
		{
			initial,
			// A remix or a ratings prefill starts fresh instead of restoring the browser draft.
			startsFresh: !!source || rated.length > 0,
			quickPicks,
			date: cardDate(new Date()),
			// Cards are signed with the person's handle; guests see a placeholder until they share.
			byline: profile ? listByline(profile.handle) : GUEST_BYLINE,
			// A member without a handle gets the handle strip and the Profile row over the editor (SiteChrome draws
			// the row for guests; the profile layout draws the chrome at /u/:handle/lists/new).
			noHandle: userId != null && !profile?.handle,
		},
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

// The editor stays out of search results, but links to it (Make your own, Remix) get a proper preview.
export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Make your top 5 · GoodWatch",
		description:
			"Rank your five favorite movies or shows and share them as a card.",
		url: "https://goodwatch.app/lists/new",
		image: "https://goodwatch.app/og/lists/new.jpg",
		alt: "Rank your top 5 movies or shows on GoodWatch and share them",
	}
	return buildMeta({ pageMeta, robots: "noindex, nofollow" })
}

export default function NewShareList() {
	const { initial, startsFresh, quickPicks, date, byline, noHandle } =
		useLoaderData<typeof loader>()
	const { pathname, search } = useLocation()
	// The browser draft is only readable after hydration; restoring it remounts the editor with the draft.
	const [start, setStart] = useState<{ draft: ListDraft; restored: boolean }>({
		draft: initial,
		restored: false,
	})
	useEffect(() => {
		if (startsFresh) return
		const draft = readBrowserDraft()
		if (draft)
			setStart({
				draft: { ...draft, design: draft.design || DEFAULT_DESIGN },
				restored: true,
			})
	}, [startsFresh])

	const flow = useShareFlow()
	// Back from sign-up or sign-in: share the saved draft once the session is known.
	const [params, setParams] = useSearchParams()
	const { user, loading } = useUser()
	const resuming = params.get("share") === "1"
	useEffect(() => {
		if (!resuming || loading) return
		setParams(
			(p) => {
				p.delete("share")
				return p
			},
			{ replace: true, preventScrollReset: true },
		)
		const draft = readBrowserDraft()
		if (user && draft && isComplete(draft)) flow.share(draft)
	}, [resuming, loading, user, setParams, flow.share])

	return (
		<>
			{noHandle && <NoHandleChrome pathname={pathname} search={search} />}
			<div className={EDITOR_UNDER_ROW}>
				<ShareListEditor
					key={start.restored ? "restored" : "initial"}
					initial={start.draft}
					quickPicks={quickPicks}
					date={date}
					byline={byline}
					saveTarget={{ kind: "draft" }}
					share={flow.share}
				/>
			</div>
			{flow.dialogs}
		</>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
