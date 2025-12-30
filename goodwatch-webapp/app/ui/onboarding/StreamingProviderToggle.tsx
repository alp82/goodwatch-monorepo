import React from "react"
import type { StreamingProvider } from "~/routes/api.streaming-providers"

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
		<button
			type="button"
			className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all
				${selected 
					? "bg-emerald-600/20 ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" 
					: "bg-slate-700/50 ring-1 ring-slate-600 hover:ring-slate-500"
				}
				${selectable ? "cursor-pointer hover:scale-105" : "opacity-60"}
			`}
			onClick={handleToggle}
		>
			<div className="w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden bg-white/5 flex items-center justify-center">
				<img
					className="w-full h-full object-cover"
					src={`https://www.themoviedb.org/t/p/original/${provider.logo_path}`}
					alt={provider.name}
				/>
			</div>
			<span className="text-[10px] md:text-xs font-medium text-white/90 text-center line-clamp-2 leading-tight px-1">
				{provider.name}
			</span>
			{selected && (
				<div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
					<svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
					</svg>
				</div>
			)}
		</button>
	)
}
