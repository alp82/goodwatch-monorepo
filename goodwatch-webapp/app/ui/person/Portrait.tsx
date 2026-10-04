import { TmdbImage, type TmdbImageProps } from "~/ui/TmdbImage"

// A person's portrait from TMDB, or their initial when there is none. Shared by the person page and search.
export function Portrait({
	path,
	name,
	className,
	width,
	priority,
}: {
	path: string | null
	name: string
	className: string
	/** The widest the portrait is displayed, in CSS pixels. */
	width: number
	priority?: TmdbImageProps["priority"]
}) {
	return path ? (
		<TmdbImage
			kind="profile"
			path={path}
			width={width}
			priority={priority}
			alt={`Portrait of ${name}`}
			className={`object-cover ${className}`}
		/>
	) : (
		<div
			className={`flex items-center justify-center bg-gray-800 text-2xl font-bold text-gray-500 ${className}`}
		>
			{name.slice(0, 1)}
		</div>
	)
}
