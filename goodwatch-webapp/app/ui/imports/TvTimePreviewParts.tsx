// The parts a TV Time preview adds to the general preview. TV Time also holds watches and show statuses, so it keeps
// the general preview's data-type and watch-date choices and composes the shipped match panel for the movies TV Time's
// own export names without a catalog ID. Matches stay in memory until Update preview turns them into a new preview,
// which replaces this one on screen. A preview that ran out of lookups, or met a lookup outage, offers to run the same
// file again: a fresh preview, since TV Time's identities are cached and each run matches more.
import { Suspense, lazy, useState } from "react"
import type { ImportSummary } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchGroup,
	usePreviewSourceImport,
	useResolveWishlistImport,
} from "./SourceImportHooks"
import type { PreviewUpdate } from "./SourceImportPreviewModel"
import {
	TVTIME_COPY,
	tvtimeMatchIntro,
	tvtimeRowsLeft,
} from "./TvTimeMatchCopy"
import type { MatchDraft, MatchTitle } from "./WishlistMatchPanel"
import {
	errorBox,
	formatCount,
	infoBox,
	primaryButton,
	secondaryButton,
} from "./shared"

const loadMatchPanel = () => import("./WishlistMatchPanel")
const WishlistMatchPanel = lazy(reloadOnStaleChunk(loadMatchPanel))

type Replace = (next: ImportSummary, update: PreviewUpdate) => void

/** The member's pending movie matches for one preview, and sending them as a new preview. */
export function useTvTimeMatching(
	summary: ImportSummary,
	confirming: boolean,
	onReplaced?: Replace,
) {
	const [draft, setDraft] = useState<MatchDraft>(new Map())
	const resolve = useResolveWishlistImport(summary.id)
	const rerun = usePreviewSourceImport()
	// While Confirm, Update preview, or a rerun runs, no match can change: it would vanish with this preview.
	const locked = confirming || resolve.isPending || rerun.isPending
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
			: !saved
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
	const runAgain = (file: File) =>
		rerun.mutate(
			{ source: "tvtime", file },
			{
				onSuccess: (response) =>
					onReplaced?.(response.import, { rewatchReset: false, rerun: true }),
			},
		)
	return {
		draft,
		locked,
		unapplied: draft.size > 0 || resolve.isPending,
		choose,
		revert,
		discard: () => !locked && setDraft(new Map()),
		update,
		resolve,
		rerun,
		runAgain,
	}
}
export type TvTimeMatching = ReturnType<typeof useTvTimeMatching>

/** Says why this preview replaced the one before it. */
export function TvTimeUpdatedNotice({ update }: { update: PreviewUpdate }) {
	return (
		<p className={infoBox}>
			{update.rerun
				? "Ran the import again with the same file. This preview replaces the earlier one."
				: "Updated with your matches. This preview replaces the earlier one, and the counts include your matches."}{" "}
			Check your choices before you import.
		</p>
	)
}

/**
 * Rows TV Time couldn't look up. Reaching the lookup limit and a lookup outage read differently, in the server's own
 * words; both can be fixed by running the file again, which needs the file this page still holds or a new choice.
 */
export function TvTimeLookupNotices({
	summary,
	matching,
	file,
	onBack,
}: {
	summary: ImportSummary
	matching: TvTimeMatching
	file?: File
	onBack: () => void
}) {
	const limit = summary.tvtimeLookupLimitCount ?? 0
	const outage = summary.tvtimeLookupUnavailableCount ?? 0
	if (limit === 0 && outage === 0) return null
	const { rerun } = matching
	const again = file ? (
		<button
			type="button"
			className={`${limit > 0 ? primaryButton : secondaryButton} self-start`}
			disabled={matching.locked}
			onClick={() => matching.runAgain(file)}
		>
			{rerun.isPending ? "Running the import again" : "Run the import again"}
		</button>
	) : (
		<button
			type="button"
			className={`${secondaryButton} self-start`}
			disabled={matching.locked}
			onClick={onBack}
		>
			Choose the file again
		</button>
	)
	const matchable = (summary.wishlistMatchCount ?? 0) > 0
	return (
		<div className="flex flex-col gap-3">
			{limit > 0 && (
				<div className={`${infoBox} flex flex-col gap-1`}>
					<p className="font-semibold">{TVTIME_COPY.lookupLimit}</p>
					<p>{tvtimeRowsLeft(limit)}</p>
					{matchable && <p>{TVTIME_COPY.rerunBeforeMatching}</p>}
				</div>
			)}
			{outage > 0 && (
				<div className="flex flex-col gap-1 rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-100">
					<p className="font-semibold">{TVTIME_COPY.lookupUnavailable}</p>
					<p>{tvtimeRowsLeft(outage)}</p>
				</div>
			)}
			{again}
			<div aria-live="assertive">
				{rerun.isError && <p className={errorBox}>{rerun.error.message}</p>}
			</div>
		</div>
	)
}

/** The movies to match, with the shipped match panel loaded on first use. */
export function TvTimeMatchSection({
	summary,
	matching,
	onBack,
}: {
	summary: ImportSummary
	matching: TvTimeMatching
	onBack: () => void
}) {
	const count = summary.wishlistMatchCount ?? 0
	const [open, setOpen] = useState(false)
	const opened = useOpenedOnce(open)
	if (count === 0) return null
	const { resolve } = matching
	return (
		<div className="flex flex-col gap-3">
			<div className="space-y-1">
				<h4 className="font-semibold text-gray-100">
					{TVTIME_COPY.matchHeading}{" "}
					<span className="font-normal text-gray-400">
						{formatCount(count)}
					</span>
				</h4>
				<p className="text-gray-300">{tvtimeMatchIntro(count)}</p>
			</div>
			<button
				type="button"
				className={`${secondaryButton} self-start`}
				aria-expanded={open}
				onPointerEnter={() => void loadMatchPanel()}
				onFocus={() => void loadMatchPanel()}
				onClick={() => setOpen((value) => !value)}
			>
				{open ? "Hide matching" : "Match movies"}
			</button>
			<div hidden={!open}>
				{opened && (
					<Suspense fallback={<Spinner size="medium" />}>
						<WishlistMatchPanel
							importId={summary.id}
							visible={open}
							draft={matching.draft}
							request={null}
							updating={resolve.isPending}
							locked={matching.locked}
							error={resolve.isError ? resolve.error : null}
							suggest={false}
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
				)}
			</div>
		</div>
	)
}
