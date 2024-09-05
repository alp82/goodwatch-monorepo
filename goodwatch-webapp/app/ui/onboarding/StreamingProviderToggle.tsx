import React from "react"
import type { StreamingProvider } from "~/server/streaming-providers.server"

interface StreamingProviderToggleProps {
	provider: StreamingProvider
	selectable?: boolean
	selected?: boolean
	onToggle?: (provider: StreamingProvider, selected: boolean) => void
}

export default function StreamingProviderToggle({
	provider,
	selectable = true,
	selected,
	onToggle,
}: StreamingProviderToggleProps) {
	const handleToggle = () => {
		if (!onToggle) return
		onToggle(provider, !selected)
	}

	return (
		<div
			key={provider.id}
			className={`w-32 p-2 flex flex-col items-center gap-2 rounded-xl border-4
				${selected ? "bg-green-900 border-green-600" : "border-gray-600"}
				${selectable ? "cursor-pointer" : ""}
				${selectable ? (selected ? "hover:border-green-500" : "opacity-60 hover:border-gray-500") : ""}
			`}
			onClick={handleToggle}
			onKeyUp={() => {}}
		>
			<img
				className="w-full rounded-lg"
				src={`https://www.themoviedb.org/t/p/original/${provider.logo_path}`}
				alt={provider.name}
			/>
			{selectable && (
				<div className="flex gap-2">
					<span className="text-sm font-semibold">{provider.name}</span>
				</div>
			)}
		</div>
	)
}
