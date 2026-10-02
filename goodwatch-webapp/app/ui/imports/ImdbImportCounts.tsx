// The counts of an import as a list that adds up, where a count opens to show its titles.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useId, useState } from "react"
import type { ImdbImportItem, ImdbImportOutcome } from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import { useImdbImportItems } from "./api"
import { formatCount, textLink } from "./shared"

export const OUTCOME_LABELS: Record<
	ImdbImportOutcome,
	{ label: string; hint?: string }
> = {
	new: { label: "Ratings to add" },
	update: {
		label: "Ratings to update",
		hint: "Changed on IMDb since your last import.",
	},
	unchanged: { label: "Already in GoodWatch with the same rating" },
	conflict: { label: "Rated differently in GoodWatch" },
	unmatched: { label: "Not in the GoodWatch catalog" },
	unsupported: {
		label: "Not supported",
		hint: "Episodes, shorts, games and other types GoodWatch doesn't rate.",
	},
	invalid: { label: "Rows we couldn't read" },
}

export function CountList({ children }: { children: ReactNode }) {
	return (
		<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60">
			{children}
		</ul>
	)
}

function Label({ label, hint }: { label: string; hint?: string }) {
	return (
		<span className="flex min-w-0 flex-1 flex-col text-left">
			<span className="text-gray-100">{label}</span>
			{hint && <span className="text-sm text-gray-400">{hint}</span>}
		</span>
	)
}

const countClass = "shrink-0 font-bold tabular-nums text-gray-100"

/** A count with nothing to open. `total` draws it as the sum of the rows above. */
export function CountRow({
	label,
	hint,
	count,
	total = false,
}: { label: string; hint?: string; count: number; total?: boolean }) {
	return (
		<li
			className={`flex items-center gap-3 px-4 py-3 ${total ? "border-t-2 border-slate-600 bg-slate-800/60 font-semibold" : ""}`}
		>
			<Label label={label} hint={hint} />
			<span className={countClass}>{formatCount(count)}</span>
			{/* Keeps the numbers in one column with the rows that have a chevron. */}
			<span className="w-5 shrink-0" aria-hidden />
		</li>
	)
}

/** A count that opens to list its titles, fetched the first time it is opened. */
export function OutcomeRow({
	importId,
	outcome,
	count,
	label = OUTCOME_LABELS[outcome].label,
	hint = OUTCOME_LABELS[outcome].hint,
}: {
	importId: string
	outcome: ImdbImportOutcome
	count: number
	label?: string
	hint?: string
}) {
	const [open, setOpen] = useState(false)
	const panelId = useId()
	if (count <= 0) return <CountRow label={label} hint={hint} count={count} />
	return (
		<li>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((value) => !value)}
				className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-800/70"
			>
				<Label label={label} hint={hint} />
				<span className={countClass}>{formatCount(count)}</span>
				<ChevronDownIcon
					className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			<div id={panelId} hidden={!open}>
				{open && <Items importId={importId} outcome={outcome} label={label} />}
			</div>
		</li>
	)
}

function Items({
	importId,
	outcome,
	label,
}: { importId: string; outcome: ImdbImportOutcome; label: string }) {
	const query = useImdbImportItems(importId, outcome, true)
	const items = query.data?.pages.flatMap((page) => page.items) ?? []
	const total = query.data?.pages[query.data.pages.length - 1]?.total ?? 0

	return (
		<div className="border-t border-slate-800 bg-gray-950/50 px-4 py-3">
			{query.isPending && (
				<div className="flex items-center gap-2 text-sm text-gray-400">
					<Spinner size="small" /> Loading titles
				</div>
			)}
			{items.length > 0 && (
				<ul aria-label={label} className="flex flex-col gap-3">
					{items.map((item, index) => (
						// The same IMDb ID can appear twice among unreadable rows.
						<Item key={`${item.imdbId}-${index}`} item={item} />
					))}
				</ul>
			)}
			{query.isSuccess && items.length === 0 && (
				<p className="text-sm text-gray-400">No titles to show.</p>
			)}
			<div
				aria-live="polite"
				className="mt-3 flex flex-wrap items-center gap-3"
			>
				{query.isError && (
					<p className="text-sm text-red-200">
						{query.error.message}{" "}
						<button
							type="button"
							className={textLink}
							onClick={() =>
								items.length > 0 ? query.fetchNextPage() : query.refetch()
							}
						>
							Try again
						</button>
					</p>
				)}
				{query.hasNextPage && !query.isError && (
					<button
						type="button"
						className={`${textLink} inline-flex min-h-11 items-center gap-2 text-sm`}
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

function Item({ item }: { item: ImdbImportItem }) {
	const details = [item.year, item.titleType].filter(Boolean).join(" · ")
	return (
		<li className="flex flex-col gap-0.5 text-sm">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
				<span className="min-w-0">
					<span className="font-semibold text-gray-100">
						{item.title || item.imdbId}
					</span>
					{details && <span className="text-gray-400"> · {details}</span>}
				</span>
				<span className="flex shrink-0 flex-wrap gap-x-3 tabular-nums text-gray-300">
					{item.imdbScore != null && <span>IMDb {item.imdbScore}</span>}
					{item.currentScore != null && (
						<span>GoodWatch {item.currentScore}</span>
					)}
				</span>
			</div>
			{item.reason && <p className="text-gray-400">{item.reason}</p>}
		</li>
	)
}
