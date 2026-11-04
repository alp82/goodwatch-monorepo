// Small pieces of the Tropes sub-page's list (TropesReader.tsx): the count line, find marks, the loading state.
import { LIST, fmt } from "~/ui/details/page-ui"
import type { TropesPageState } from "./model"

/** "12 of 276 · matching “spice”", or the way out when nothing matches. */
export function Count({ s }: { s: TropesPageState }) {
	if (!s.rows.length)
		return (
			<p aria-live="polite" className="text-sm text-gray-400">
				No trope matches{s.q.trim() ? ` “${s.q.trim()}”` : ""}.{" "}
				<button
					type="button"
					onClick={s.clear}
					className="cursor-pointer font-semibold text-amber-300/90 hover:text-amber-300"
				>
					Show all
				</button>
			</p>
		)
	const filtered = s.q.trim() || s.filter !== "all"
	return (
		<p aria-live="polite" className="text-xs text-gray-500">
			{filtered
				? `${fmt(s.rows.length)} of ${fmt(s.total)}`
				: `${fmt(s.total)} tropes, A to Z`}
			{s.q.trim() ? ` matching “${s.q.trim()}”` : ""}
		</p>
	)
}

/** The text with each case-insensitive hit of `q` marked in quiet amber. */
export function Marked({ text, q }: { text: string; q: string }) {
	const needle = q.trim()
	if (needle.length < 2) return <>{text}</>
	const parts = text.split(
		new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
	)
	return (
		<>
			{parts.map((p, i) =>
				i % 2 ? (
					<mark
						// biome-ignore lint/suspicious/noArrayIndexKey: parts never reorder
						key={i}
						className="rounded-sm bg-amber-300/15 text-amber-100 not-italic"
					>
						{p}
					</mark>
				) : (
					p
				),
			)}
		</>
	)
}

export function Loading() {
	return (
		<output aria-busy className="flex flex-col gap-6">
			<span className="sr-only">Loading tropes…</span>
			<div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.04]" />
			<div className="grid gap-3 md:grid-cols-2">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-12 animate-pulse rounded-lg bg-white/[0.03]"
					/>
				))}
			</div>
			<div className={`${LIST}`}>
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="flex h-12 items-center px-3">
						<div className="h-3.5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
					</div>
				))}
			</div>
		</output>
	)
}
