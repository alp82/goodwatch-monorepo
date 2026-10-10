import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useId, useState } from "react"
import type { ImportItem, ImportOutcome } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { useSourceImportItems } from "./SourceImportHooks"
import { formatCount, textLink } from "./shared"

export const SOURCE_OUTCOME_LABELS: Record<ImportOutcome, string> = {
	new: "New in GoodWatch",
	unchanged: "Already the same in GoodWatch",
	conflict: "Different in GoodWatch",
	unmatched: "Not in the GoodWatch catalog",
	unsupported: "Data GoodWatch can't import",
	invalid: "Rows we couldn't read",
}

export function SourceOutcomeRow({
	importId,
	outcome,
	count,
}: { importId: string; outcome: ImportOutcome; count: number }) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	const label = SOURCE_OUTCOME_LABELS[outcome]
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
					<SourceItems importId={importId} outcome={outcome} label={label} />
				)}
			</div>
		</li>
	)
}

function SourceItems({
	importId,
	outcome,
	label,
}: { importId: string; outcome: ImportOutcome; label: string }) {
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
						<SourceItem key={`${item.index}-${item.key}`} item={item} />
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

function SourceItem({ item }: { item: ImportItem }) {
	const location =
		item.episode != null
			? `S${item.season ?? "?"} E${item.episode}`
			: item.mediaType === "show"
				? "Show"
				: "Movie"
	const value =
		item.score != null
			? `Source ${item.score}`
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
					{value && <span>{value}</span>}
					{applied && (
						<span className="font-semibold text-gray-100">{applied}</span>
					)}
				</span>
			</div>
			{item.reason && <p className="text-gray-400">{item.reason}</p>}
		</li>
	)
}
