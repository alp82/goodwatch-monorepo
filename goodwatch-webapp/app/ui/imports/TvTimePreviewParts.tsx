import { Suspense, useEffect, useRef, useState } from "react"
import type { ImportSummary } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { MatchCount } from "./ImportFlowParts"
import {
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchGroup,
	useAcceptTvTimeSuggestions,
	useDiscardSourceImport,
	useLoadSourceImport,
	useResolveTvTimeImport,
} from "./SourceImportHooks"
import type { PreviewUpdate } from "./SourceImportPreviewModel"
import {
	TVTIME_COPY,
	tvtimeMatchIntro,
	tvtimeProgress,
	tvtimeRowsLeft,
} from "./TvTimeMatchCopy"
import type { MatchDraft, MatchTitle } from "./WishlistMatchPanel"
import { WishlistMatchPanel } from "./WishlistMatching"
import { errorBox, formatCount, infoBox, secondaryButton } from "./shared"

type Replace = (next: ImportSummary, update: PreviewUpdate) => void

/** The member's pending movie matches for one preview, and sending them as a new preview. */
export function useTvTimeMatching(
	summary: ImportSummary,
	confirming: boolean,
	onReplaced?: Replace,
) {
	const [draft, setDraft] = useState<MatchDraft>(new Map())
	const resolve = useResolveTvTimeImport(summary.id)
	const bulk = useAcceptTvTimeSuggestions(summary.id)
	const cancel = useDiscardSourceImport(summary.id)
	const load = useLoadSourceImport()
	const leaving = useRef(false)
	const blocked = useRef(false)
	// Every action is tied to this preview. Never replace it during a member decision.
	const locked =
		confirming ||
		resolve.isPending ||
		bulk.isPending ||
		cancel.isPending ||
		load.isPending
	blocked.current =
		confirming ||
		resolve.isPending ||
		bulk.isPending ||
		cancel.isPending ||
		draft.size > 0
	const replacementId = summary.resolution?.replacementId
	const replacement =
		replacementId && replacementId !== summary.id ? replacementId : null
	const loadLatest = () => {
		if (!replacement || blocked.current || leaving.current) return
		load.mutate(replacement, {
			onSuccess: (response) => {
				if (!leaving.current && !blocked.current)
					onReplaced?.(response.import, {
						rewatchReset: false,
						background: true,
					})
			},
		})
	}
	// A failed load is retried explicitly. A late response cannot throw away a choice or follow discard.
	useEffect(() => {
		if (replacement && !blocked.current && !leaving.current && load.isIdle)
			loadLatest()
	}, [replacement, load.isIdle, loadLatest])
	const set = (index: number, title: MatchTitle | null | undefined) => {
		const next = new Map(draft)
		if (title === undefined) next.delete(index)
		else next.set(index, title)
		setDraft(next)
	}
	/** Records a choice, or returns false while locked or past the per-update limit. */
	const choose = (group: WishlistMatchGroup, title: MatchTitle | null) => {
		if (locked) return false
		const index = group.representativeIndex
		const saved = group.item.wishlistResolution
		const same = title
			? saved?.mediaType === title.mediaType && saved.tmdbId === title.tmdbId
			: !saved && group.matchScope !== "tvtime_movie"
		if (!same && !draft.has(index) && draft.size >= WISHLIST_MATCH_MAX_CHANGES)
			return false
		set(index, same ? undefined : title)
		return true
	}
	const revert = (group: WishlistMatchGroup) => {
		if (locked || !draft.has(group.representativeIndex)) return false
		set(group.representativeIndex, undefined)
		return true
	}
	const update = () => {
		if (locked || draft.size === 0) return
		resolve.mutate(
			[...draft].map(([index, title]) => ({
				index,
				target: title
					? { mediaType: title.mediaType, tmdbId: title.tmdbId }
					: null,
			})),
			{
				onSuccess: (response) =>
					onReplaced?.(response.import, { rewatchReset: false }),
			},
		)
	}
	const acceptAll = (token: string) => {
		if (locked || draft.size > 0) return
		bulk.mutate(token, {
			onSuccess: (response) =>
				onReplaced?.(response.import, {
					rewatchReset: false,
					acceptedCount: response.acceptedCount,
				}),
		})
	}
	const discardPreview = (onBack: () => void) => {
		if (locked) return
		leaving.current = true
		cancel.mutate(undefined, {
			onSuccess: onBack,
			onError: () => {
				leaving.current = false
			},
		})
	}
	return {
		draft,
		locked,
		unapplied: draft.size > 0 || resolve.isPending,
		choose,
		revert,
		discard: () => !locked && setDraft(new Map()),
		update,
		resolve,
		bulk,
		acceptAll,
		cancel,
		discardPreview,
		replacement,
		load,
		loadLatest,
	}
}
export type TvTimeMatching = ReturnType<typeof useTvTimeMatching>

/** Says why this preview replaced the one before it. */
export function TvTimeUpdatedNotice({ update }: { update: PreviewUpdate }) {
	return (
		<p className={infoBox}>
			{update.background
				? "GoodWatch finished matching. This preview replaces the earlier one."
				: update.acceptedCount !== undefined
					? `Accepted ${formatCount(update.acceptedCount)} ${update.acceptedCount === 1 ? "suggestion" : "suggestions"}. This preview replaces the earlier one. Nothing is imported until you start the import.`
					: "Updated with your matches. This preview replaces the earlier one, and the counts include your matches."}{" "}
			Check your choices before you import.
		</p>
	)
}

/** Live progress belongs to the job; row counts still describe the preview on screen. */
export function TvTimeLookupNotices({
	summary,
	matching,
}: {
	summary: ImportSummary
	matching: TvTimeMatching
}) {
	const progress = summary.resolution
		? tvtimeProgress(summary.resolution)
		: null
	const limit = summary.tvtimeLookupLimitCount ?? 0
	const outage = summary.tvtimeLookupUnavailableCount ?? 0
	return (
		<div className="flex flex-col gap-3">
			{progress?.active && summary.resolution && (
				<div
					className="flex flex-col gap-1 text-sm text-gray-400"
					data-matching
				>
					<p className="font-semibold text-gray-200" aria-live="polite">
						{progress.step}{" "}
						<span className="font-normal text-gray-400">
							<MatchCount
								done={summary.resolution.processed}
								total={summary.resolution.total}
							/>
						</span>
					</p>
					<p>
						You can leave this page. Matching keeps going, and your preview is
						here when you open TV Time again.
					</p>
				</div>
			)}
			{matching.replacement && (
				<div className={`${infoBox} space-y-3`}>
					<p>
						GoodWatch finished matching. Update the preview or discard your
						changes, then load the latest preview.
					</p>
					<button
						type="button"
						className={secondaryButton}
						disabled={matching.locked || matching.unapplied}
						onClick={matching.loadLatest}
					>
						Load the latest preview
					</button>
				</div>
			)}
			{!progress?.active && limit > 0 && (
				<div className={`${infoBox} space-y-1`}>
					<p className="font-semibold">{TVTIME_COPY.lookupLimit}</p>
					<p>{tvtimeRowsLeft(limit)}</p>
					<p>
						To run it again, discard this preview and choose the file again.
					</p>
				</div>
			)}
			{!progress?.active && outage > 0 && (
				<div className="space-y-1 rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-100">
					<p className="font-semibold">{TVTIME_COPY.lookupUnavailable}</p>
					<p>{tvtimeRowsLeft(outage)}</p>
					<p>
						To run it again, discard this preview and choose the file again.
					</p>
				</div>
			)}
			{summary.resolution?.state === "failed" && (
				<p className={errorBox}>
					Matching couldn't finish. Discard this preview and import the file
					again to retry.
				</p>
			)}
			{matching.load.isError && (
				<p className={errorBox}>{matching.load.error.message}</p>
			)}
			{matching.cancel.isError && (
				<p className={errorBox}>{matching.cancel.error.message}</p>
			)}
		</div>
	)
}

/** The movies to match, in the shipped match panel, open on its question's screen. */
export function TvTimeMatchPanel({
	summary,
	matching,
	visible,
	onBack,
}: {
	summary: ImportSummary
	matching: TvTimeMatching
	visible: boolean
	onBack: () => void
}) {
	const { resolve } = matching
	return (
		<div className="flex flex-col gap-3">
			<p className="text-gray-300">
				{tvtimeMatchIntro(
					summary.wishlistMatchCount ?? 0,
					summary.wishlistUnresolvedMatchCount,
				)}
			</p>
			<Suspense fallback={<Spinner size="medium" />}>
				<WishlistMatchPanel
					importId={summary.id}
					visible={visible}
					draft={matching.draft}
					request={null}
					updating={resolve.isPending}
					locked={matching.locked}
					error={
						resolve.isError
							? resolve.error
							: matching.bulk.isError
								? matching.bulk.error
								: null
					}
					tvtimeBulkAccept={matching.acceptAll}
					note={TVTIME_COPY.watchesFirst}
					onChoose={matching.choose}
					onRevert={matching.revert}
					onAcceptAll={() => false}
					onUndoAccepted={() => 0}
					bulkAccepted={0}
					onDiscard={matching.discard}
					onUpdate={matching.update}
					onBack={onBack}
				/>
			</Suspense>
		</div>
	)
}
