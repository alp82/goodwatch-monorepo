// Autosave for the share list editor, half a second after each change. A new list saves as a draft in this browser
// (a visit to /lists/new restores it); a saved list saves to the server through /api/share-lists.
import { useEffect, useState } from "react"
import { isDesignKey } from "~/ui/share-card/designs"
import {
	type CardTitle,
	isPromptId,
	isThemeKey,
	LIST_SIZE,
} from "~/ui/share-card/model"
import type { ListDraft, ListState } from "~/ui/share-list-editor/list-state"

const DEBOUNCE_MS = 500
const DRAFT_KEY = "goodwatch:share-list-draft"

export type SaveStatus = "idle" | "saving" | "saved" | "incomplete" | "failed"
export type SaveTarget = { kind: "draft" } | { kind: "list"; id: string }

/** The draft saved in this browser, if there is a valid one. */
export function readBrowserDraft(): ListDraft | null {
	try {
		const draft = JSON.parse(
			localStorage.getItem(DRAFT_KEY) ?? "null",
		) as Partial<ListDraft> | null
		if (
			!draft ||
			typeof draft.title !== "string" ||
			!Array.isArray(draft.items)
		)
			return null
		const items = (draft.items as CardTitle[])
			.filter((i) => typeof i?.key === "string" && typeof i.title === "string")
			.slice(0, LIST_SIZE)
		return {
			title: draft.title,
			promptId: isPromptId(draft.promptId) ? draft.promptId : null,
			design: isDesignKey(draft.design) ? draft.design : "",
			theme: isThemeKey(draft.theme) ? draft.theme : "ember",
			signature: typeof draft.signature === "string" ? draft.signature : "",
			items,
			remixedFrom:
				typeof draft.remixedFrom === "string" ? draft.remixedFrom : null,
		}
	} catch {
		return null
	}
}

export function clearBrowserDraft() {
	try {
		localStorage.removeItem(DRAFT_KEY)
	} catch {}
}

/** The request body /api/share-lists expects for a draft. */
export const listInput = (draft: ListDraft) => ({
	title: draft.title,
	promptId: draft.promptId,
	design: draft.design,
	theme: draft.theme,
	signature: draft.signature,
	items: draft.items.map((i) => i.key),
	remixedFrom: draft.remixedFrom ?? null,
})

export const isComplete = (draft: ListDraft) =>
	draft.items.length === LIST_SIZE && draft.title.trim().length > 0

export function useAutosave(list: ListState, target: SaveTarget) {
	const [status, setStatus] = useState<SaveStatus>("idle")
	const snapshot = JSON.stringify(list.draft)
	const targetKey = target.kind === "list" ? target.id : "draft"

	useEffect(() => {
		// Nothing to save until the person changes something.
		if (list.version.current === 0) return
		const draft = JSON.parse(snapshot) as ListDraft
		if (target.kind === "list" && !isComplete(draft)) {
			setStatus("incomplete")
			return
		}
		setStatus("saving")
		const controller = new AbortController()
		const timer = setTimeout(async () => {
			if (target.kind === "draft") {
				try {
					localStorage.setItem(DRAFT_KEY, snapshot)
					setStatus("saved")
				} catch {
					setStatus("failed")
				}
				return
			}
			try {
				const response = await fetch("/api/share-lists", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						intent: "update",
						id: target.id,
						list: listInput(draft),
					}),
					signal: controller.signal,
				})
				setStatus(response.ok ? "saved" : "failed")
			} catch (error) {
				if (!controller.signal.aborted) setStatus("failed")
			}
		}, DEBOUNCE_MS)
		return () => {
			clearTimeout(timer)
			controller.abort()
		}
		// targetKey stands in for target, which is a new object on every render.
	}, [snapshot, targetKey])

	return status
}
