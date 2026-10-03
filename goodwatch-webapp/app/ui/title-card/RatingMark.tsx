import type { RatingBadge } from "~/domain/age-content"

/**
 * A title's age rating as a small badge: on a card while an age limit is on, and on the Age & content control for the
 * limit itself. An estimate ("~12", for a title not rated in the viewer's country) is softer, with a dashed edge.
 */
export function RatingMark({
	rating,
	className = "",
}: {
	rating: RatingBadge
	className?: string
}) {
	return (
		<span
			title={
				rating.estimated
					? "Not rated in your country; rated about this age elsewhere"
					: undefined
			}
			className={`inline-flex h-6 shrink-0 items-center rounded-md bg-gray-950/85 px-1.5 text-xs font-black whitespace-nowrap ${
				rating.estimated
					? "border border-dashed border-white/40 text-gray-300"
					: "text-white ring-1 ring-white/40"
			} ${className}`}
		>
			<span className="sr-only">
				{rating.estimated ? "Estimated age " : "Rated "}
			</span>
			{rating.label}
		</span>
	)
}
