interface GenreBadgeProps {
	genre: string
	size?: "sm" | "md"
}

export default function GenreBadge({ genre, size = "md" }: GenreBadgeProps) {
	const sizeClasses = size === "sm" 
		? "px-2 py-0.5 text-xs" 
		: "px-3 py-1 text-sm"
	
	return (
		<span className={`${sizeClasses} bg-gray-900/80 border-2 border-white/15 text-white font-medium rounded-lg`}>
			{genre}
		</span>
	)
}
