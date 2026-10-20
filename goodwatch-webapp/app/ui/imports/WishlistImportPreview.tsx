// The preview of a wishlist import (a Watcharr export or a wishlist file). It only adds Want to See, so it hides the
// general preview's data-type and watch-date choices. Source Seen evidence can offer Want to rewatch;
// season/episode entries additionally need the independent whole-show opt-in. Neither creates viewing history.
// Entries whose file gave no type are reviewed in a panel that loads on first use: the member accepts GoodWatch's
// suggestions or matches entries by hand. Its choices live here, in memory, so hiding the panel keeps them; Update
// preview turns them into a new preview.
import { Suspense, lazy, useRef, useState } from "react"
import type {
	ImportOptions,
	ImportOutcome,
	ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { FocusHeading } from "./FocusHeading"
import { ImportNotes } from "./ImportNotes"
import { SourceOutcomeRow } from "./SourceImportCounts"
import {
	WISHLIST_MATCH_MAX_CHANGES,
	type WishlistMatchGroup,
	useResolveWishlistImport,
} from "./SourceImportHooks"
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

/** How this preview came about, when it replaced one the member updated with their matches. */
export type WishlistPreviewUpdate = { rewatchReset: boolean }

const OUTCOMES: ImportOutcome[] = [
	"new",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
]

export function WishlistImportPreview({
	summary,
	focus,
	confirming,
	error,
	onConfirm,
	onBack,
	onPreviewReplaced,
	updated,
}: {
	summary: ImportSummary
	focus: boolean
	confirming: boolean
	error: string | null
	onConfirm: (options: ImportOptions) => void
	onBack: () => void
	/** Shows the new preview that Update preview made. This preview stays as it was. */
	onPreviewReplaced?: (
		next: ImportSummary,
		update: WishlistPreviewUpdate,
	) => void
	updated?: WishlistPreviewUpdate
}) {
	const [seenChoice, setSeenChoice] =
		useState<ImportOptions["conflictChoice"]>("keep")
	const [wishlistShows, setWishlistShows] = useState(false)
	const [matching, setMatching] = useState(false)
	const opened = useOpenedOnce(matching)
	const [draft, setDraft] = useState<MatchDraft>(new Map())
	// The suggestions the last bulk accepts put in the draft. Undo takes back only those still as accepted.
	const [bulk, setBulk] = useState<MatchDraft>(new Map())
	const [request, setRequest] = useState<{ index: number; seq: number } | null>(
		null,
	)
	// Hide matching clears the request, but the panel stays mounted and remembers the last sequence it handled.
	// So the sequence keeps counting on its own: a later Change, even for the same row, always gets a new one.
	const requestSeq = useRef(0)
	const resolve = useResolveWishlistImport(summary.id)
	const showChoices = summary.wishlistShowChoiceCount ?? 0
	const explicitChoices = summary.wishlistRewatchChoiceCount !== undefined
	const seen = summary.wishlistRewatchChoiceCount ?? summary.counts.conflict
	const one = seen === 1
	const rewatch = seen > 0 && seenChoice === "source"
	const matchable = summary.wishlistMatchCount ?? 0
	const unapplied = draft.size > 0 || resolve.isPending
	// No count on the button: the import rechecks each title against the current library as it runs.
	const rewatchOnly = summary.counts.conflict - showChoices
	const showOnly = summary.counts.conflict - seen
	const canImport =
		summary.counts.new > 0 ||
		(rewatch && (rewatchOnly > 0 || wishlistShows)) ||
		(wishlistShows && showOnly > 0)
	const reason = unapplied
		? "wishlist-import-unapplied"
		: !canImport
			? "wishlist-import-required"
			: undefined
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
	const bulkOwned = [...bulk].filter(([index, title]) => {
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
					onPreviewReplaced?.(response.import, {
						rewatchReset: rewatch || wishlistShows,
					}),
			},
		)
	}
	const changeMatch = (index: number) => {
		if (locked) return
		setMatching(true)
		requestSeq.current += 1
		setRequest({ index, seq: requestSeq.current })
	}
	return (
		<section className="flex flex-col gap-5">
			<div className="space-y-2">
				<FocusHeading focus={focus}>Check before you import</FocusHeading>
				<p>
					Here is what we found in{" "}
					<span className="break-all font-semibold text-gray-100">
						{summary.fileName}
					</span>
					. Nothing has been saved yet.
				</p>
			</div>
			{updated && (
				<p className={infoBox}>
					Updated with your changes. The counts include them.
					{updated.rewatchReset &&
						(explicitChoices
							? " Your optional choices have been reset. Review them before adding titles."
							: " Your choice for titles you've already seen is back to Leave them as Seen.")}
				</p>
			)}
			<ImportNotes warnings={summary.warnings} title="About this file" />
			<div className="space-y-1 text-sm text-gray-400">
				<p>
					Importing only adds titles to Want to See. It never removes anything
					from your Wishlist.
				</p>
				<p>
					Adding a title to Want to See takes it off Not interested. Undo takes
					the title off Want to See but doesn't mark it Not interested again.
				</p>
			</div>
			{showChoices > 0 && (
				<label className="flex items-start gap-3 rounded-lg border border-slate-700 p-3">
					<input
						type="checkbox"
						checked={wishlistShows}
						onChange={(event) => setWishlistShows(event.target.checked)}
						disabled={locked}
						className="mt-1 size-4 accent-indigo-500"
					/>
					<span>
						<span className="block font-semibold text-gray-100">
							Want to See the show
						</span>
						<span className="block text-sm text-gray-400">
							This file lists seasons or episodes of {formatCount(showChoices)}{" "}
							{showChoices === 1 ? "show" : "shows"}. Add the whole show to your
							Wishlist. No episode progress is imported. Titles marked Seen also
							need your Want to rewatch choice.
						</span>
					</span>
				</label>
			)}
			{seen > 0 && (
				<fieldset className="space-y-2">
					<legend className="mb-1 font-semibold text-gray-100">
						{formatCount(seen)} {one ? "title" : "titles"}{" "}
						{explicitChoices
							? "marked Seen in GoodWatch or in this file"
							: "you've already seen"}
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						<Radio
							checked={seenChoice === "keep"}
							onChange={() => setSeenChoice("keep")}
							label={
								explicitChoices
									? "Leave off Wishlist"
									: one
										? "Leave it as Seen"
										: "Leave them as Seen"
							}
							detail={
								one
									? "It stays off your Wishlist."
									: "They stay off your Wishlist."
							}
						/>
						<Radio
							checked={seenChoice === "source"}
							onChange={() => setSeenChoice("source")}
							label={
								one
									? "Add it as Want to rewatch"
									: "Add them as Want to rewatch"
							}
							detail={
								one
									? "It goes on your Wishlist to watch again. Nothing else changes."
									: "They go on your Wishlist to watch again. Nothing else changes."
							}
						/>
					</div>
				</fieldset>
			)}
			{matchable > 0 && (
				<div className="flex flex-col gap-3">
					<div className="space-y-1">
						<h4 className="font-semibold text-gray-100">
							Titles to check before you add them
						</h4>
						<p className="text-gray-300">
							Your file doesn't say whether{" "}
							{matchable === 1
								? "this entry is a movie or a show"
								: `these ${formatCount(matchable)} entries are movies or shows`}
							, so GoodWatch didn't add {matchable === 1 ? "it" : "them"} on its
							own. Review {matchable === 1 ? "it" : "them"} to accept a match
							GoodWatch suggests or to find{" "}
							{matchable === 1 ? "it" : "each one"} yourself. Titles you don't
							accept or match aren't added.
						</p>
					</div>
					<button
						type="button"
						className={`${secondaryButton} self-start`}
						aria-expanded={matching}
						onPointerEnter={() => void loadMatchPanel()}
						onFocus={() => void loadMatchPanel()}
						onClick={() => {
							setRequest(null)
							setMatching((value) => !value)
						}}
					>
						{matching ? "Hide matching" : "Review matches"}
					</button>
					<div hidden={!matching}>
						{opened && (
							<Suspense fallback={<Spinner size="medium" />}>
								<WishlistMatchPanel
									importId={summary.id}
									visible={matching}
									draft={draft}
									request={request}
									updating={resolve.isPending}
									locked={locked}
									error={resolve.isError ? resolve.error : null}
									onChoose={choose}
									onRevert={revert}
									onAcceptAll={acceptAll}
									onUndoAccepted={undoAccepted}
									bulkAccepted={bulkOwned}
									onDiscard={discard}
									onUpdate={update}
									onBack={onBack}
								/>
							</Suspense>
						)}
					</div>
				</div>
			)}
			<div>
				<h4 className="mb-2 font-semibold text-gray-100">How titles compare</h4>
				<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60">
					{OUTCOMES.filter((outcome) => summary.counts[outcome] > 0).map(
						(outcome) => (
							<SourceOutcomeRow
								key={outcome}
								importId={summary.id}
								outcome={outcome}
								count={summary.counts[outcome]}
								labelOverride={
									explicitChoices && outcome === "conflict"
										? "Needs your choice"
										: undefined
								}
								wishlist
								onChangeMatch={matchable > 0 ? changeMatch : undefined}
								matchLocked={locked}
							/>
						),
					)}
					<li className="flex items-center justify-between border-t-2 border-slate-600 bg-slate-800/60 px-4 py-3 font-semibold">
						<span>Entries in your file</span>
						<span className="tabular-nums">
							{formatCount(summary.counts.rows)}
						</span>
					</li>
				</ul>
			</div>
			{unapplied && (
				<p id="wishlist-import-unapplied" className="text-sm text-gray-300">
					Your matches aren't in this preview yet. Choose Update preview to add
					them, or Discard changes. Choosing another file or leaving this page
					discards them.
				</p>
			)}
			{!canImport && (
				<p id="wishlist-import-required" className="text-sm text-gray-300">
					{showChoices > 0
						? "Choose Want to See the show to add whole shows from season or episode entries. Titles marked Seen also need your Want to rewatch choice."
						: seen > 0
							? `Nothing new to add. To add the ${one ? "title" : "titles"} you've already seen, choose ${one ? "Add it" : "Add them"} as Want to rewatch.`
							: "Nothing to add. GoodWatch already has the titles in this file, or can't add them."}
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={primaryButton}
					disabled={!canImport || unapplied || confirming}
					aria-describedby={reason}
					onClick={() =>
						canImport &&
						!unapplied &&
						onConfirm({
							kinds: ["want"],
							conflictChoice: seenChoice,
							watchDates: "preserve",
							...(showChoices > 0 ? { wishlistShows } : {}),
						})
					}
				>
					{confirming ? "Adding to Want to See" : "Add to Want to See"}
				</button>
				<button
					type="button"
					className={secondaryButton}
					disabled={confirming || resolve.isPending}
					onClick={onBack}
				>
					Choose another file
				</button>
			</div>
			<div aria-live="assertive">
				{error && <p className={errorBox}>{error}</p>}
			</div>
		</section>
	)
}

function Radio({
	checked,
	onChange,
	label,
	detail,
}: {
	checked: boolean
	onChange: () => void
	label: string
	detail: string
}) {
	return (
		<label
			className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900/60"}`}
		>
			<input
				type="radio"
				name="wishlist-seen"
				checked={checked}
				onChange={onChange}
				className="mt-1 size-4 accent-indigo-500"
			/>
			<span>
				<span className="block font-semibold text-gray-100">{label}</span>
				<span className="block text-sm text-gray-400">{detail}</span>
			</span>
		</label>
	)
}
