import type { ReactNode } from "react"

const SIZE = {
	section: "text-xl sm:text-2xl",
	group: "text-lg sm:text-xl",
}

/**
 * The one section heading (D4): system font, semibold, tight tracking, 20 px on phones and 24 px from `sm`. A `group`
 * heading inside a section (person decades, /new days, Seen months) is one step smaller. `className` is for layout.
 */
export function SectionHeading({
	as: Tag = "h2",
	size = "section",
	id,
	className = "",
	children,
}: {
	as?: "h1" | "h2" | "h3" | "span"
	size?: keyof typeof SIZE
	id?: string
	className?: string
	children: ReactNode
}) {
	return (
		<Tag id={id} className={`${SIZE[size]} font-semibold tracking-tight text-white ${className}`}>
			{children}
		</Tag>
	)
}
