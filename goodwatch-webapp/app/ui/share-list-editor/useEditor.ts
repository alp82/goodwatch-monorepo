// Everything the editor's parts share: the list, drag and drop, the open dialog, and hover previews.
// Hover previews change what the card shows without touching the list, so nothing saves until a click.
import { useState } from "react"
import type { CardDesignOption } from "~/ui/share-card/model"
import {
	type CardTitle,
	DEFAULT_PROMPT_ID,
	LIST_SIZE,
	THEMES,
	type ThemeKey,
} from "~/ui/share-card/model"
import { type DragPayload, type DropTarget, useDragAndDrop } from "~/ui/share-list-editor/drag"
import { type ListDraft, useListState } from "~/ui/share-list-editor/list-state"

export type Dialog = { kind: "rank"; index: number } | { kind: "title" } | null

export function useEditor({
	designOptions,
	initial,
	quickPicks,
	date,
	byline,
}: {
	designOptions: CardDesignOption[]
	initial: ListDraft
	quickPicks: Record<string, CardTitle[]>
	date: string
	/** Who the card is signed by: the owner's @handle, or a placeholder until a guest shares. */
	byline: string
}) {
	const list = useListState(initial)
	const [dialog, setDialog] = useState<Dialog>(null)
	const [previewDesign, setPreviewDesign] = useState<string | null>(null)
	const [previewTheme, setPreviewTheme] = useState<ThemeKey | null>(null)

	const dnd = useDragAndDrop((payload: DragPayload, target: DropTarget) => {
		if (target.kind === "list") list.insert(payload.item, target.index)
		else list.place(payload.item, target.index)
	})

	const designByKey = (key: string) => designOptions.find((d) => d.key === key) ?? designOptions[0]
	const design = designByKey(list.design)
	const index = designOptions.findIndex((d) => d.key === design.key)
	const shownTheme = previewTheme ?? list.theme

	return {
		list,
		date,
		dnd,
		dialog,
		setDialog,
		designOptions,
		design,
		/** The design and theme the card shows right now, including hover previews. */
		shown: {
			design: previewDesign ? designByKey(previewDesign) : design,
			theme: shownTheme,
			colors: THEMES[shownTheme],
		},
		colors: THEMES[list.theme],
		setPreviewDesign,
		setPreviewTheme,
		stepDesign: (step: number) =>
			list.set({
				design: designOptions[(index + step + designOptions.length) % designOptions.length].key,
			}),
		quickPicks:
			quickPicks[list.promptId ?? DEFAULT_PROMPT_ID] ?? quickPicks[DEFAULT_PROMPT_ID] ?? [],
		/** The card's props for the shown design and theme. */
		card: {
			title: list.title,
			items: list.items.slice(0, LIST_SIZE),
			name: byline,
			theme: shownTheme,
			date,
		},
	}
}
export type Editor = ReturnType<typeof useEditor>
