// Matching wishlist entries whose file gave no type, or whose IDs disagree. The member accepts GoodWatch's suggestions
// or matches entries by hand in a panel that loads on first use. Their choices live here, in memory, so going back and
// forth between questions keeps them; Update preview turns them into a new preview.
import { Suspense, lazy, useState } from "react"
import type { ImportSummary } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchGroup,
	useResolveWishlistImport,
} from "./SourceImportHooks"
import type { PreviewUpdate } from "./SourceImportPreviewModel"
import type { MatchDraft, MatchTitle } from "./WishlistMatchPanel"

export const loadMatchPanel = () => import("./WishlistMatchPanel")
export const WishlistMatchPanel = lazy(reloadOnStaleChunk(loadMatchPanel))

/** How this preview came about, when it replaced one the member updated with their matches. */
export type WishlistPreviewUpdate = { rewatchReset: boolean }

/** The member's pending matches for one wishlist preview, and sending them as a new preview. */
export function useWishlistMatching(
	summary: ImportSummary,
	confirming: boolean,
	onReplaced:
		| ((next: ImportSummary, update: PreviewUpdate) => void)
		| undefined,
	/** Whether the member chose an optional addition the new preview resets. */
	choicesReset: () => boolean,
) {
	const [draft, setDraft] = useState<MatchDraft>(new Map())
	// The suggestions the last bulk accepts put in the draft. Undo takes back only those still as accepted.
	const [bulk, setBulk] = useState<MatchDraft>(new Map())
	const resolve = useResolveWishlistImport(summary.id)
	// While Confirm or Update preview runs, no match can change: a choice made now would vanish with this preview.
	const locked = confirming || resolve.isPending
	/** Records a choice, or returns false when it can't: while locked, or when it would pass the per-update limit. */
	const choose = (group: WishlistMatchGroup, title: MatchTitle | null) => {
		if (locked) return false
		const index = group.representativeIndex
		const saved = group.item.wishlistResolution
		const same = title
			? saved?.mediaType === title.mediaType && saved.tmdbId === title.tmdbId
			: !saved
		if (!same && !draft.has(index) && draft.size >= WISHLIST_MATCH_MAX_CHANGES)
			return false
		const next = new Map(draft)
		if (same) next.delete(index)
		else next.set(index, title)
		setDraft(next)
		if (bulk.has(index)) {
			const owned = new Map(bulk)
			owned.delete(index)
			setBulk(owned)
		}
		return true
	}
	/** Takes back a pending change, so the entry is as this preview has it. */
	const revert = (group: WishlistMatchGroup) => {
		if (locked || !draft.has(group.representativeIndex)) return false
		const next = new Map(draft)
		next.delete(group.representativeIndex)
		setDraft(next)
		if (bulk.has(group.representativeIndex)) {
			const owned = new Map(bulk)
			owned.delete(group.representativeIndex)
			setBulk(owned)
		}
		return true
	}
	/** Accepts every given suggestion as one change, or none of them when locked or past the per-update limit. */
	const acceptAll = (
		accepted: readonly { group: WishlistMatchGroup; title: MatchTitle }[],
	) => {
		const fresh = accepted.filter(
			({ group }) => !draft.has(group.representativeIndex),
		)
		if (
			locked ||
			fresh.length === 0 ||
			draft.size + fresh.length > WISHLIST_MATCH_MAX_CHANGES
		)
			return false
		const next = new Map(draft)
		const owned = new Map(bulk)
		for (const { group, title } of fresh) {
			next.set(group.representativeIndex, title)
			owned.set(group.representativeIndex, title)
		}
		setDraft(next)
		setBulk(owned)
		return true
	}
	/** Takes back the bulk accepts the member hasn't changed since. Returns how many. */
	const undoAccepted = () => {
		if (locked) return 0
		const next = new Map(draft)
		let undone = 0
		for (const [index, title] of bulk) {
			const now = draft.get(index)
			if (
				now &&
				title &&
				now.mediaType === title.mediaType &&
				now.tmdbId === title.tmdbId
			) {
				next.delete(index)
				undone++
			}
		}
		setDraft(next)
		setBulk(new Map())
		return undone
	}
	const bulkAccepted = [...bulk].filter(([index, title]) => {
		const now = draft.get(index)
		return (
			!!now &&
			!!title &&
			now.mediaType === title.mediaType &&
			now.tmdbId === title.tmdbId
		)
	}).length
	const discard = () => {
		if (locked) return
		setDraft(new Map())
		setBulk(new Map())
	}
	const update = () => {
		if (locked || draft.size === 0 || draft.size > WISHLIST_MATCH_MAX_CHANGES)
			return
		resolve.mutate(
			[...draft].map(([index, title]) => ({
				index,
				target: title
					? { mediaType: title.mediaType, tmdbId: title.tmdbId }
					: null,
			})),
			{
				onSuccess: (response) =>
					onReplaced?.(response.import, { rewatchReset: choicesReset() }),
			},
		)
	}
	return {
		draft,
		locked,
		unapplied: draft.size > 0 || resolve.isPending,
		resolve,
		choose,
		revert,
		acceptAll,
		undoAccepted,
		bulkAccepted,
		discard,
		update,
	}
}
export type WishlistMatching = ReturnType<typeof useWishlistMatching>

/** The wishlist match panel, open on its question's screen. */
export function WishlistMatchHost({
	summary,
	matching,
	visible,
	onBack,
}: {
	summary: ImportSummary
	matching: WishlistMatching
	visible: boolean
	onBack: () => void
}) {
	return (
		<Suspense fallback={<Spinner size="medium" />}>
			<WishlistMatchPanel
				importId={summary.id}
				visible={visible}
				draft={matching.draft}
				request={null}
				updating={matching.resolve.isPending}
				locked={matching.locked}
				error={matching.resolve.isError ? matching.resolve.error : null}
				onChoose={matching.choose}
				onRevert={matching.revert}
				onAcceptAll={matching.acceptAll}
				onUndoAccepted={matching.undoAccepted}
				bulkAccepted={matching.bulkAccepted}
				onDiscard={matching.discard}
				onUpdate={matching.update}
				onBack={onBack}
			/>
		</Suspense>
	)
}
