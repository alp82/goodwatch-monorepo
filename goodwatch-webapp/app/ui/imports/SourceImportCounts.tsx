import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useId, useState } from "react"
import { IMPORT_SHOW_STATUS_LABELS } from "~/domain/imports"
import type { ImportItem, ImportOutcome } from "~/domain/imports"
import { searchHref } from "~/ui/navigation/destinations"
import { Spinner } from "~/ui/wait/Spinner"
import { useSourceImportItems } from "./SourceImportHooks"
import { sourceItemLocation } from "./SourceImportPreviewModel"
import { formatCount, textLink } from "./shared"

export const SOURCE_OUTCOME_LABELS: Record<ImportOutcome, string> = {
	new: "New in GoodWatch",
	unchanged: "Already the same in GoodWatch",
	conflict: "Different in GoodWatch",
	unmatched: "Not matched to a GoodWatch title",
	unsupported: "Data GoodWatch can't import",
	invalid: "Rows we couldn't read",
}

/** The same outcomes, in the words of a wishlist import, which only adds to Want to See. */
export const WISHLIST_OUTCOME_LABELS: Record<ImportOutcome, string> = {
	new: "New to your Wishlist",
	// Already on the Wishlist, or a show whose GoodWatch status stays.
	unchanged: "Nothing to change",
	conflict: "Seen in GoodWatch",
	unmatched: "Not matched to a GoodWatch title",
	unsupported: "Not added to Want to See",
	invalid: "Entries we couldn't read",
}

export function SourceOutcomeRow({
	importId,
	outcome,
	count,
	labelOverride,
	wishlist = false,
	onChangeMatch,
	matchLocked = false,
}: {
	importId: string
	outcome: ImportOutcome
	count: number
	labelOverride?: string
	wishlist?: boolean
	/** Opens the matching panel at a row the member matched, in a wishlist preview. */
	onChangeMatch?: (index: number) => void
	/** Turns Change off while the preview is being imported or updated. */
	matchLocked?: boolean
}) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	const label =
		labelOverride ??
		(wishlist ? WISHLIST_OUTCOME_LABELS : SOURCE_OUTCOME_LABELS)[outcome]
	return (
		<li>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((value) => !value)}
				disabled={count === 0}
				className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left enabled:cursor-pointer enabled:hover:bg-slate-800/70 disabled:cursor-default"
			>
				<span className="min-w-0 flex-1 text-gray-100">{label}</span>
				<span className="font-bold tabular-nums text-gray-100">
					{formatCount(count)}
				</span>
				<ChevronDownIcon
					className={`size-5 shrink-0 text-gray-400 ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			<div id={panelId} hidden={!open}>
				{open && (
					<SourceItems
						importId={importId}
						outcome={outcome}
						label={label}
						wishlist={wishlist}
						onChangeMatch={onChangeMatch}
						matchLocked={matchLocked}
					/>
				)}
			</div>
		</li>
	)
}

function SourceItems({
	importId,
	outcome,
	label,
	wishlist,
	onChangeMatch,
	matchLocked,
}: {
	importId: string
	outcome: ImportOutcome
	label: string
	wishlist: boolean
	onChangeMatch?: (index: number) => void
	matchLocked: boolean
}) {
	const query = useSourceImportItems(importId, outcome, true)
	const items = query.data?.pages.flatMap((page) => page.items) ?? []
	const total = query.data?.pages.at(-1)?.total ?? 0
	return (
		<div className="border-t border-slate-800 bg-gray-950/50 px-4 py-3">
			{query.isPending && (
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Spinner size="small" /> Loading rows
				</div>
			)}
			{items.length > 0 && (
				<ul aria-label={label} className="flex flex-col gap-3">
					{items.map((item) => (
						<SourceItem
							key={`${item.index}-${item.key}`}
							item={item}
							wishlist={wishlist}
							onChangeMatch={onChangeMatch}
							matchLocked={matchLocked}
						/>
					))}
				</ul>
			)}
			{query.isSuccess && items.length === 0 && (
				<p className="text-sm text-gray-400">No rows to show.</p>
			)}
			<div
				className="mt-3 flex flex-wrap items-center gap-3"
				aria-live="polite"
			>
				{query.isError && (
					<p className="text-sm text-red-200">
						{query.error.message}{" "}
						<button
							type="button"
							className={textLink}
							onClick={() =>
								items.length ? query.fetchNextPage() : query.refetch()
							}
						>
							Try again
						</button>
					</p>
				)}
				{query.hasNextPage && !query.isError && (
					<button
						type="button"
						className={`${textLink} min-h-11 text-sm`}
						disabled={query.isFetchingNextPage}
						onClick={() => query.fetchNextPage()}
					>
						{query.isFetchingNextPage ? "Loading more" : "Show more"}
					</button>
				)}
				{items.length > 0 && (
					<span className="text-sm text-gray-500">
						Showing {formatCount(items.length)} of {formatCount(total)}
					</span>
				)}
			</div>
		</div>
	)
}

/**
 * One row of an outcome list. A wishlist row says Type unknown when its source didn't say (the row is stored as a
 * movie), and an unmatched one links to a search for its title. A row the member matched shows the GoodWatch title
 * first and the file's own title, year, and ID after it.
 */
export function SourceItem({
	item,
	wishlist = false,
	onChangeMatch,
	matchLocked = false,
}: {
	item: ImportItem
	wishlist?: boolean
	onChangeMatch?: (index: number) => void
	matchLocked?: boolean
}) {
	if (item.customList) {
		const message =
			item.applyState === "added" || item.applyState === "updated"
				? "List created."
				: item.applyState === "undone"
					? (item.customList.undoReason ?? "List deleted by Undo.")
					: item.applyState === "kept"
						? "This list was not imported."
						: item.applyState === "failed"
							? "The list could not be created. Try again to finish the import."
							: item.reason
		return (
			<li className="space-y-2 px-4 py-3">
				<p className="font-semibold text-gray-100">{item.customList.name}</p>
				{item.customList.description && (
					<p className="whitespace-pre-wrap break-words text-gray-300">
						{item.customList.description}
					</p>
				)}
				{message && <p className="text-gray-400">{message}</p>}
				{item.customList.createdId &&
					(item.applyState === "added" ||
						item.applyState === "updated" ||
						!!item.customList.undoReason) && (
						<a
							className={textLink}
							href={`/lists/${item.customList.createdId}`}
						>
							Open list
						</a>
					)}
				<details>
					<summary className="cursor-pointer text-gray-300">
						Source list entries ({item.customList.entries.length})
					</summary>
					<ol className="ml-6 list-decimal space-y-2">
						{item.customList.entries.map(({ position, note, entry }, at) => (
							<li key={at} value={position} className="text-gray-300">
								<span>
									{entry.title}
									{entry.year ? ` (${entry.year})` : ""}
								</span>
								{entry.problem && (
									<p className="text-gray-400">
										Not imported: {entry.problem.reason}
									</p>
								)}
								{note && (
									<p className="whitespace-pre-wrap break-words">{note}</p>
								)}
							</li>
						))}
					</ol>
				</details>
			</li>
		)
	}
	const matched = wishlist ? item.wishlistResolution : undefined
	if (matched)
		return (
			<MatchedItem item={item} onChange={onChangeMatch} locked={matchLocked} />
		)
	const location = sourceItemLocation(item, wishlist)
	const search = wishlist && item.outcome === "unmatched" && item.title.trim()
	const value = item.showStatus
		? IMPORT_SHOW_STATUS_LABELS[item.showStatus]
		: item.score != null
			? `Source ${item.score}`
			: item.kind === "want" && item.addedAt
				? `Added ${item.addedAt.slice(0, 10)}`
				: item.watchedAt
					? `Watched ${item.watchedAt.slice(0, 10)}`
					: null
	const applied = item.applyState
		? (
				{
					added: "Added",
					updated: "Updated",
					kept: "Kept",
					failed: "Failed",
					undone: "Undone",
				} as const
			)[item.applyState]
		: null
	return (
		<li className="text-sm">
			<div className="flex flex-wrap justify-between gap-2">
				<span>
					<span className="font-semibold text-gray-100">
						{item.title || item.key}
					</span>
					<span className="text-gray-400">
						{" "}
						· {[item.year, location].filter(Boolean).join(" · ")}
					</span>
				</span>
				<span className="flex gap-3 tabular-nums text-gray-300">
					{search && (
						<a
							href={searchHref(item.title)}
							target="_blank"
							rel="noopener noreferrer"
							className={textLink}
						>
							Search<span className="sr-only"> for {item.title} (new tab)</span>
						</a>
					)}
					{value && <span>{value}</span>}
					{applied && (
						<span className="font-semibold text-gray-100">{applied}</span>
					)}
				</span>
			</div>
			{item.reason && <p className="text-gray-400">{item.reason}</p>}
			{item.imdbList && (
				<details className="mt-1 text-gray-400">
					<summary className="cursor-pointer">IMDb list details</summary>
					<dl className="space-y-1">
						<dt>Position on IMDb</dt>
						<dd>{item.imdbList.position || "Unknown"}</dd>
						<dt>Added on IMDb</dt>
						<dd>{item.imdbList.created || "Unknown"}</dd>
						{item.imdbList.modified && (
							<>
								<dt>Modified on IMDb</dt>
								<dd>{item.imdbList.modified}</dd>
							</>
						)}
						{item.imdbList.description && (
							<>
								<dt>List note</dt>
								<dd className="whitespace-pre-wrap break-words">
									{item.imdbList.description}
								</dd>
							</>
						)}
						{item.imdbList.rawRating && (
							<>
								<dt>Your IMDb rating</dt>
								<dd>
									{item.imdbList.rawRating}
									{item.imdbList.dateRated
										? ` · Rated ${item.imdbList.dateRated}`
										: ""}
								</dd>
							</>
						)}
					</dl>
				</details>
			)}
		</li>
	)
}

const APPLY_LABELS = {
	added: "Added",
	updated: "Updated",
	kept: "Kept",
	failed: "Failed",
	undone: "Undone",
} as const

function MatchedItem({
	item,
	onChange,
	locked,
}: {
	item: ImportItem
	onChange?: (index: number) => void
	locked: boolean
}) {
	const matched = item.wishlistResolution
	if (!matched) return null
	const original = item.wishlistOriginal
	const evidence = original?.wishlistEvidence ?? item.wishlistEvidence
	const fileTitle = (original?.title ?? item.title).trim()
	const fromFile = [
		fileTitle || "No title",
		original?.year ?? null,
		evidence?.mediaType === "show"
			? "Show"
			: evidence?.mediaType === "movie"
				? "Movie"
				: "Type unknown",
		evidence?.sourceId ? `ID ${evidence.sourceId}` : null,
	]
		.filter(Boolean)
		.join(" · ")
	return (
		<li className="text-sm">
			<div className="flex flex-wrap justify-between gap-2">
				<span>
					<span className="font-semibold text-gray-100">{matched.title}</span>
					<span className="text-gray-400">
						{" "}
						·{" "}
						{[matched.year, matched.mediaType === "show" ? "Show" : "Movie"]
							.filter(Boolean)
							.join(" · ")}
					</span>
					<span className="font-semibold text-gray-200"> · Matched by you</span>
				</span>
				<span className="flex gap-3 tabular-nums text-gray-300">
					{onChange && (
						<button
							type="button"
							className={`${textLink} min-h-11 disabled:cursor-not-allowed disabled:opacity-60`}
							disabled={locked}
							onClick={() => onChange(item.index)}
						>
							Change
							<span className="sr-only">
								{" "}
								the match for {fileTitle || "this entry"}
							</span>
						</button>
					)}
					{item.applyState && (
						<span className="font-semibold text-gray-100">
							{APPLY_LABELS[item.applyState]}
						</span>
					)}
				</span>
			</div>
			<p className="break-words text-gray-400">From your file: {fromFile}</p>
			{item.reason && <p className="text-gray-400">{item.reason}</p>}
		</li>
	)
}
