import React from "react"

export interface PingProps {
	size: "small" | "medium" | "large"
}

export const Ping = ({ size }: PingProps) => {
	const sizeClasses =
		size === "small" ? "w-4 h-4" : size === "medium" ? "w-8 h-8" : "w-12 h-12"

	return (
		<div role="status">
			<span
				className={`absolute top-2 left-2 ${sizeClasses} inline-flex rounded-full bg-sky-300 opacity-75 animate-ping`}
			/>
			<span className="sr-only">Loading...</span>
		</div>
	)
}
