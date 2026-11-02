// Match the recommendation accordion and its account-action bar while picks load.
export function ForYouSkeleton() {
	return (
		<div
			aria-hidden
			className="fy-accordion spotlight-pad absolute inset-0 flex flex-col gap-3 py-3"
		>
			<div className="fy-toolbar">
				<span className="h-3 w-36 animate-pulse rounded bg-gray-800" />
			</div>
			<div className="fy-row flex min-h-0 flex-1 gap-2">
				{Array.from({ length: 6 }, (_, i) => (
					<div
						key={i}
						className="fy-card min-w-0 flex-1 animate-pulse rounded-xl bg-gray-800/70"
						data-expanded={i === 0}
						style={{ animationDelay: `${i * 80}ms` }}
					/>
				))}
			</div>
			<div className="fy-save">
				<div className="flex flex-col gap-2">
					<span className="h-3 w-44 animate-pulse rounded bg-gray-800" />
					<span className="h-3 w-36 animate-pulse rounded bg-gray-800" />
				</div>
				<span className="h-11 w-44 animate-pulse rounded-lg bg-amber-400/10" />
			</div>
		</div>
	)
}
