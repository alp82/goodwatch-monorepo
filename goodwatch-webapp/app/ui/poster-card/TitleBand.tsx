import type { ReactNode } from "react"

// The title and year at the poster's foot, on a dark band that fades into the art. The viewer's service logos (and,
// under 4.5rem, the age badge) sit in the band above the title. Screen readers get the title from the card's link, so
// the band is hidden from them. `yearEnd` sits at the end of the year's row (the award mark).
export function TitleBand({
	title,
	year,
	top,
	yearEnd,
}: {
	title: ReactNode
	year?: number | string | null
	/** The row above the title: logos, badge. */
	top?: ReactNode
	/** At the end of the year's row. */
	yearEnd?: ReactNode
}) {
	return (
		<div
			aria-hidden
			data-title-band=""
			className="absolute inset-x-0 bottom-0 rounded-b-md bg-gradient-to-t from-gray-950 via-gray-950/85 to-transparent px-1.5 pt-6 pb-1.5 @min-[11rem]/card:px-2.5 @min-[11rem]/card:pt-10 @min-[11rem]/card:pb-2.5"
		>
			{top}
			<span className="line-clamp-2 text-[0.6875rem] leading-tight font-semibold text-white @min-[7.5rem]/card:text-xs @min-[11rem]/card:text-sm">
				{title}
			</span>
			{yearEnd ? (
				<span className="flex min-w-0 items-center gap-1 text-[0.625rem] text-gray-300 @min-[7.5rem]/card:text-xs">
					{year ? <span className="shrink-0">{year}</span> : null}
					{yearEnd}
				</span>
			) : year ? (
				<span className="block text-[0.625rem] text-gray-300 @min-[7.5rem]/card:text-xs">
					{year}
				</span>
			) : null}
		</div>
	)
}
