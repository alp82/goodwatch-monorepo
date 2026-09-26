// A person's portrait from TMDB, or their initial when there is none. Shared by the person page and search.
export function Portrait({
	path,
	name,
	className,
}: { path: string | null; name: string; className: string }) {
	return path ? (
		<img
			src={`https://image.tmdb.org/t/p/w300_and_h450_bestv2${path}`}
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
