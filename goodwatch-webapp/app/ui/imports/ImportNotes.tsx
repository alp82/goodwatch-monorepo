import { formatCount } from "./shared"

/** Export details are context, not an alert. Bound both the default view and the expanded list. */
export function ImportNotes({
	warnings,
	title,
}: {
	warnings: string[]
	title: string
}) {
	if (warnings.length === 0) return null
	const notes = (
		<ul className="max-h-40 space-y-1 overflow-y-auto break-words pl-5 list-disc">
			{warnings.map((warning, index) => (
				<li key={`${index}:${warning}`}>{warning}</li>
			))}
		</ul>
	)
	return warnings.length > 3 ? (
		<details className="max-w-prose text-sm text-gray-400">
			<summary className="cursor-pointer text-gray-300 focus-visible:outline focus-visible:outline-indigo-400">
				{title} ({formatCount(warnings.length)})
			</summary>
			<div className="mt-2">{notes}</div>
		</details>
	) : (
		<div className="max-w-prose space-y-1 text-sm text-gray-400">
			<p className="font-semibold text-gray-300">{title}</p>
			{notes}
		</div>
	)
}
