/** Progress as a row of dots: `at` of `of` filled. The rating flow and the Taste banner use it. */
export function RatingDots({ at, of }: { at: number; of: number }) {
	return (
		<span
			className="inline-flex gap-1.5"
			role="img"
			aria-label={`${Math.min(at, of)} of ${of}`}
		>
			{Array.from({ length: of }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length dots
					key={i}
					className={`h-2.5 w-2.5 rounded-full ${i < at ? "bg-amber-400" : "bg-white/15"}`}
				/>
			))}
		</span>
	)
}
