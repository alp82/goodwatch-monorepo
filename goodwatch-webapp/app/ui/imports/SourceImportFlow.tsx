import { useEffect, useState } from "react"
import type { ImportSource, ImportSummary } from "~/domain/imports"
import { SourceImportCurrent } from "./SourceImportCurrent"
import { type ImportListResponse, useSourceImports } from "./SourceImportHooks"
import { SourceImportUploadPanel } from "./SourceImportUploadPanel"
import {
	card,
	formatCount,
	formatDate,
	primaryButton,
	secondaryButton,
	stepHeading,
	textLink,
} from "./shared"

const sourceName = (source: ImportSource) =>
	source === "letterboxd" ? "Letterboxd" : "Trakt"
const outcome = (item: ImportSummary) =>
	item.status === "undone"
		? "Undone"
		: item.status === "failed"
			? "Didn't finish"
			: item.status === "running"
				? "In progress"
				: `${formatCount(item.applied.added)} added, ${formatCount(item.applied.updated)} updated`

export function SourceImportFlow({
	source,
	initial,
}: { source: ImportSource; initial: ImportListResponse }) {
	const query = useSourceImports(initial)
	const history = (query.data?.imports ?? []).filter(
		(item) => item.source === source && item.status !== "preview",
	)
	const latest = history[0]
	const [openId, setOpenId] = useState<string | null>(null)
	const [uploadOpen, setUploadOpen] = useState(!latest)
	const [acted, setActed] = useState(false)
	const shownId =
		openId ?? (!uploadOpen && latest?.status === "running" ? latest.id : null)
	useEffect(() => {
		if (!openId && shownId) setOpenId(shownId)
	}, [openId, shownId])
	const open = (id: string) => {
		setActed(true)
		setUploadOpen(false)
		setOpenId(id)
	}
	const upload = () => {
		setActed(true)
		setOpenId(null)
		setUploadOpen(true)
	}
	const others = history.filter((item) => item.id !== (shownId ?? latest?.id))
	return (
		<div className="flex flex-col gap-8">
			{shownId ? (
				<SourceImportCurrent
					key={shownId}
					id={shownId}
					focus={acted}
					onUploadAnother={upload}
				/>
			) : (
				<>
					{latest && (
						<section className={`${card} flex flex-col gap-3`}>
							<div>
								<h3 className={stepHeading}>
									Latest {sourceName(source)} import
								</h3>
								<p className="text-gray-400">
									{formatDate(latest.finishedAt ?? latest.createdAt)} ·{" "}
									{outcome(latest)}{" "}
									<span className="break-all">· {latest.fileName}</span>
								</p>
							</div>
							<div className="flex flex-wrap gap-3">
								{!uploadOpen && (
									<button
										type="button"
										className={primaryButton}
										onClick={upload}
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
						<SourceImportUploadPanel
							source={source}
							onPreview={(summary) => open(summary.id)}
						/>
					)}
				</>
			)}
			{others.length > 0 && (
				<section className="space-y-3">
					<h3 className={stepHeading}>Earlier {sourceName(source)} imports</h3>
					<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60 text-sm">
						{others.map((item) => (
							<li
								key={item.id}
								className="flex items-center justify-between gap-4 px-4 py-2"
							>
								<span>
									<span className="font-semibold text-gray-100">
										{formatDate(item.finishedAt ?? item.createdAt)}
									</span>
									<span className="text-gray-400"> · {outcome(item)}</span>
								</span>
								<button
									type="button"
									className={`${textLink} min-h-11`}
									onClick={() => open(item.id)}
								>
									Details
									<span className="sr-only">
										{" "}
										of import from {formatDate(item.createdAt)}
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
