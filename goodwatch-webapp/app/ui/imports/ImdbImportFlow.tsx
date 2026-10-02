// The IMDb ratings import on /settings/imports: one page whose steps replace each other in place.
//   no import yet        the upload, then how to get the file
//   earlier imports      the latest one's date and outcome, Upload a newer export, and the earlier ones
//   an import open       its preview, progress or receipt (ImdbImportCurrent)
// A running import is opened on arrival, so its progress shows directly.
import { useEffect, useState } from "react"
import type {
	ImdbImportListResponse,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { ImdbExportSteps } from "./ImdbExportSteps"
import { ImdbImportCurrent } from "./ImdbImportCurrent"
import { ImdbUpload } from "./ImdbUpload"
import { useImdbImports } from "./api"
import {
	card,
	describeOutcome,
	formatDate,
	primaryButton,
	secondaryButton,
	stepHeading,
	textLink,
} from "./shared"

const importDate = (summary: ImdbImportSummary) =>
	formatDate(summary.finishedAt ?? summary.createdAt)

const importHeading = (summary: ImdbImportSummary) => {
	const date = importDate(summary)
	if (summary.status === "undone") return `Import from ${date}, undone`
	if (summary.status === "failed") return `Import from ${date} didn't finish`
	if (summary.status === "running") return `Import from ${date}, in progress`
	return `Imported on ${date}`
}

export function ImdbImportFlow({ initial }: { initial?: ImdbImportListResponse }) {
	const list = useImdbImports(initial)
	const [openId, setOpenId] = useState<string | null>(null)
	const [uploadOpen, setUploadOpen] = useState(false)
	// Once the person has done something here, a step that appears takes focus. Not on arrival.
	const [acted, setActed] = useState(false)

	// A preview is not an import yet, so it has no place in the history.
	const history = (list.data?.imports ?? []).filter(
		(item) => item.status !== "preview",
	)
	const latest = history[0]
	const shownId =
		openId ?? (!uploadOpen && latest?.status === "running" ? latest.id : null)
	// Keep a running import open once it finishes, so its receipt follows its progress.
	useEffect(() => {
		if (!openId && shownId) setOpenId(shownId)
	}, [openId, shownId])

	const open = (id: string) => {
		setActed(true)
		setUploadOpen(false)
		setOpenId(id)
	}
	const openUpload = () => {
		setActed(true)
		setOpenId(null)
		setUploadOpen(true)
	}

	const others = history.filter((item) => item.id !== (shownId ?? latest?.id))
	const shownIsOlder =
		!!shownId &&
		history.some((item) => item.id === shownId) &&
		shownId !== latest?.id

	return (
		<div className="flex flex-col gap-8">
			{shownId ? (
				<ImdbImportCurrent
					key={shownId}
					id={shownId}
					focus={acted}
					onUploadAnother={openUpload}
				/>
			) : (
				<>
					{latest && (
						<section
							aria-labelledby="imdb-latest-heading"
							className={`${card} flex flex-col gap-3`}
						>
							<div>
								<h3 id="imdb-latest-heading" className={stepHeading}>
									{importHeading(latest)}
								</h3>
								<p className="text-gray-400">
									{describeOutcome(latest)}
									<span className="break-all"> · {latest.fileName}</span>
								</p>
							</div>
							<p>
								Importing again adds the ratings that are new since then and
								lets you review the ones that changed. It never removes
								anything.
							</p>
							<div className="flex flex-wrap items-center gap-3">
								{!uploadOpen && (
									<button
										type="button"
										className={primaryButton}
										onClick={openUpload}
									>
										Upload a newer export
									</button>
								)}
								<button
									type="button"
									className={secondaryButton}
									onClick={() => open(latest.id)}
								>
									View details
								</button>
							</div>
						</section>
					)}
					{(!latest || uploadOpen) && (
						<>
							<ImdbUpload onPreview={(summary) => open(summary.id)} />
							<ImdbExportSteps focus={acted && uploadOpen} />
						</>
					)}
				</>
			)}

			{others.length > 0 && (
				<section
					aria-labelledby="imdb-history-heading"
					className="flex flex-col gap-3"
				>
					<h3 id="imdb-history-heading" className={stepHeading}>
						{shownIsOlder ? "Other imports" : "Earlier imports"}
					</h3>
					<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60 text-sm">
						{others.map((item) => (
							<li
								key={item.id}
								className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2"
							>
								<span className="min-w-0">
									<span className="font-semibold text-gray-100">
										{importDate(item)}
									</span>
									<span className="text-gray-400">
										{" "}
										· {describeOutcome(item)}
									</span>
								</span>
								<button
									type="button"
									className={`${textLink} min-h-11`}
									onClick={() => open(item.id)}
								>
									Details
									<span className="sr-only">
										{" "}
										of the import from {importDate(item)}
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	)
}
