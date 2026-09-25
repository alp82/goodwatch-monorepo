// The editor for a new share list. ?remix=<list id> starts from another list's prompt and titles.
// A new list saves as a draft in this browser until it's shared; a visit without ?remix restores that draft.
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { useEffect, useState } from "react"
import { getList } from "~/server/share-lists/store.server"
import {
	getQuickPicks,
	resolveCardTitles,
} from "~/server/share-lists/titles.server"
import { DEFAULT_DESIGN } from "~/ui/share-card/designs"
import {
	cardDate,
	DEFAULT_PROMPT_ID,
	DEFAULT_THEME,
	LIST_PROMPTS,
} from "~/ui/share-card/model"
import { readBrowserDraft } from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import { ShareListEditor } from "~/ui/share-list-editor/ShareListEditor"

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

export async function loader({ request }: LoaderFunctionArgs) {
	const remixId = new URL(request.url).searchParams.get("remix")
	const [quickPicks, source] = await Promise.all([
		getQuickPicks(),
		remixId ? getList(remixId) : null,
	])
	// A remix is a new list with the source's prompt, titles, design, and colors. The signature stays the viewer's.
	const initial: ListDraft = source
		? {
				title: source.title,
				promptId: source.promptId,
				design: source.design,
				theme: source.theme,
				signature: "",
				items: await resolveCardTitles(source.items),
				remixedFrom: source.id,
			}
		: EMPTY_DRAFT
	return json({
		initial,
		isRemix: !!source,
		quickPicks,
		date: cardDate(new Date()),
	})
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
	const { initial, isRemix, quickPicks, date } = useLoaderData<typeof loader>()
	// The browser draft is only readable after hydration; restoring it remounts the editor with the draft.
	const [start, setStart] = useState<{ draft: ListDraft; restored: boolean }>({
		draft: initial,
		restored: false,
	})
	useEffect(() => {
		if (isRemix) return
		const draft = readBrowserDraft()
		if (draft)
			setStart({
				draft: { ...draft, design: draft.design || DEFAULT_DESIGN },
				restored: true,
			})
	}, [isRemix])

	return (
		<ShareListEditor
			key={start.restored ? "restored" : "initial"}
			initial={start.draft}
			quickPicks={quickPicks}
			date={date}
			saveTarget={{ kind: "draft" }}
		/>
	)
}
