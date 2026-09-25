// The editor for a new share list. ?remix=<list id> starts from another list's prompt and titles.
// ?from=ratings starts from the person's highest-rated titles ("Share your top 5" on Taste): signed-in people's
// come from their ratings, guests send their ranked ratings as ?titles=movie:603,show:1399.
// A new list saves as a draft in this browser until it's shared; a visit that starts fresh doesn't restore it.
// ?share=1 is where sign-up and sign-in return to: it shares the restored draft (see ShareFlow).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import {
	prefillTitles,
	topRatedEntries,
} from "~/server/share-lists/prefill.server"
import { getList, getProfileByUserId } from "~/server/share-lists/store.server"
import {
	type ListEntry,
	getQuickPicks,
	parseTitleKey,
	resolveCardTitles,
} from "~/server/share-lists/titles.server"
import { DEFAULT_DESIGN } from "~/ui/share-card/designs"
import {
	DEFAULT_PROMPT_ID,
	DEFAULT_THEME,
	LIST_PROMPTS,
	cardDate,
} from "~/ui/share-card/model"
import { PREFILL_CANDIDATES, prefillPrompt } from "~/ui/share-card/prefill"
import { useShareFlow } from "~/ui/share-list-editor/ShareFlow"
import { ShareListEditor } from "~/ui/share-list-editor/ShareListEditor"
import { isComplete, readBrowserDraft } from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import { getUserIdFromRequest, useUser } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

const EMPTY_DRAFT: ListDraft = {
	title: LIST_PROMPTS[0].title,
	promptId: DEFAULT_PROMPT_ID,
	design: DEFAULT_DESIGN,
	theme: DEFAULT_THEME,
	signature: "",
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

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const remixId = params.get("remix")
	const fromRatings = !remixId && params.get("from") === "ratings"
	const userId = await getUserIdFromRequest({ request })
	const [quickPicks, source, profile, rated] = await Promise.all([
		getQuickPicks(),
		remixId ? getList(remixId) : null,
		userId ? getProfileByUserId(userId) : null,
		fromRatings ? ratedEntries(params, userId).then(prefillTitles) : [],
	])
	// New lists sign with the person's handle once they have one.
	const signature = profile ? `@${profile.handle}` : ""
	// A remix is a new list with the source's prompt, titles, design, and colors. The signature stays the viewer's.
	const initial: ListDraft = source
		? {
				title: source.title,
				promptId: source.promptId,
				design: source.design,
				theme: source.theme,
				signature,
				items: await resolveCardTitles(source.items),
				remixedFrom: source.id,
			}
		: rated.length
			? {
					...EMPTY_DRAFT,
					...prefillPrompt(rated.map((t) => t.type)),
					signature,
					items: rated,
				}
			: { ...EMPTY_DRAFT, signature }
	return json(
		{
			initial,
			// A remix or a ratings prefill starts fresh instead of restoring the browser draft.
			startsFresh: !!source || rated.length > 0,
			quickPicks,
			date: cardDate(new Date()),
		},
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction = () => [
	{ title: "Make your top 5 · GoodWatch" },
	{
		name: "description",
		content:
			"Rank your five favorite movies or shows and share them as a card.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export default function NewShareList() {
	const { initial, startsFresh, quickPicks, date } =
		useLoaderData<typeof loader>()
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
			<ShareListEditor
				key={start.restored ? "restored" : "initial"}
				initial={start.draft}
				quickPicks={quickPicks}
				date={date}
				saveTarget={{ kind: "draft" }}
				share={flow.share}
			/>
			{flow.dialogs}
		</>
	)
}
