import type { ImportWarning } from "~/domain/imports"
import { formatCount } from "./shared"

/** Keep failures visible; only informational export context may be collapsed. */
export function ImportNotes({
	warnings,
	title,
}: { warnings: ImportWarning[]; title: string }) {
	const actionable = warnings.filter((warning) => warning.kind === "actionable")
	const info = warnings.filter((warning) => warning.kind === "info")
	if (warnings.length === 0) return null
	return (
		<div className="max-w-prose space-y-2 text-sm text-gray-400">
			{actionable.length > 0 && (
				<div className="space-y-1">
					<p className="font-semibold text-gray-300">Check before importing</p>
					<ul className="list-disc space-y-1 break-words pl-5">
						{actionable.map((warning, index) => (
							<li key={`${index}:${warning.message}`}>{warning.message}</li>
						))}
					</ul>
				</div>
			)}
			{info.length > 3 ? (
				<details>
					<summary className="cursor-pointer text-gray-300 focus-visible:outline focus-visible:outline-indigo-400">
						{title} ({formatCount(info.length)})
					</summary>
					<div className="mt-2">
						<InformationList warnings={info} />
					</div>
				</details>
			) : info.length > 0 ? (
				<div className="space-y-1">
					<p className="font-semibold text-gray-300">{title}</p>
					<InformationList warnings={info} />
				</div>
			) : null}
		</div>
	)
}

function InformationList({ warnings }: { warnings: ImportWarning[] }) {
	return (
		<ul className="max-h-40 space-y-1 overflow-y-auto break-words pl-5 list-disc">
			{warnings.map((warning, index) => (
				<li key={`${index}:${warning.message}`}>{warning.message}</li>
			))}
		</ul>
	)
}
