// The For you box until its picks arrive, and until ForYouPanel's code does (it loads on first use, SpotlightCard.tsx):
// the same box as the panel's, so nothing shifts when either comes in.
export function ForYouSkeleton() {
	return (
		<div
			aria-hidden
			className="spotlight-pad absolute inset-0 flex gap-4 pt-2.5 pb-3 sm:pt-3 sm:pb-4 lg:gap-6"
		>
			<div className="min-w-0 flex-1 animate-pulse rounded-xl bg-gray-800/70 sm:flex-[1.3] sm:rounded-2xl lg:flex-1" />
			<div className="flex min-w-0 flex-1 items-center gap-3 max-sm:hidden">
				{Array.from({ length: 4 }, (_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
						key={i}
						className="aspect-[2/3] flex-1 animate-pulse rounded-md bg-gray-800/70"
						style={{ animationDelay: `${i * 80}ms` }}
					/>
				))}
			</div>
		</div>
	)
}
