// Class strings and small formatters shared by the IMDb import screens.
import type { ImdbImportSummary } from "~/domain/imdb-import"

export const IMPORTS_PATH = "/settings/imports"

export const primaryButton =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-indigo-700 px-4 py-2 text-base font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-gray-400"
export const secondaryButton =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-base font-semibold text-gray-200 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
export const dangerButton =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-red-700 bg-red-900/60 px-4 py-2 text-base font-semibold text-red-100 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
export const textLink =
	"cursor-pointer font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
export const card = "rounded-lg border border-slate-700 bg-slate-900/60 p-4"
export const stepHeading =
	"font-bold tracking-tight text-gray-100 text-lg outline-none"
export const errorBox =
	"py-3 px-4 text-base border-l-8 border-red-700 text-red-100 bg-red-950"
export const infoBox =
	"py-3 px-4 text-base border-l-8 border-blue-700 text-blue-100 bg-blue-950"

export const formatCount = (n: number) => n.toLocaleString()

/** "1 rating", "842 ratings". */
export const ratings = (n: number) =>
	`${formatCount(n)} ${n === 1 ? "rating" : "ratings"}`

/** "1 title", "842 titles". */
export const titles = (n: number) =>
	`${formatCount(n)} ${n === 1 ? "title" : "titles"}`

export const formatDate = (iso: string) => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime())
		? iso
		: date.toLocaleDateString(undefined, { dateStyle: "long" })
}

/** Rows the import leaves out: not in the catalog, not supported, or unreadable. */
export const skippedCount = (summary: ImdbImportSummary) =>
	summary.counts.unmatched + summary.counts.unsupported + summary.counts.invalid

/** One line on how an import ended, for the history. */
export const describeOutcome = (summary: ImdbImportSummary) => {
	if (summary.status === "undone") return "Undone"
	if (summary.status === "failed") return "Didn't finish"
	if (summary.status === "running") return "In progress"
	if (summary.status === "preview") return "Not imported yet"
	const { added, updated, failed } = summary.applied
	const parts = [
		added > 0 ? `${ratings(added)} added` : null,
		updated > 0 ? `${formatCount(updated)} updated` : null,
		failed > 0 ? `${formatCount(failed)} not saved` : null,
	].filter(Boolean)
	return parts.length > 0 ? parts.join(", ") : "Nothing new to add"
}
