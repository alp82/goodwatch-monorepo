import React from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import type { StreamingProvider } from "~/server/streaming-providers.server"

interface StreamingProviderSelectionProps {
	provider: StreamingProvider
}

export default function StreamingProviderSelection({
	provider,
}: StreamingProviderSelectionProps) {
	return (
		<div
			key={provider.id}
			className={
				"p-1 flex items-center gap-2 rounded-xl bg-green-900 border-2 border-green-600"
			}
		>
			<TmdbImage
				kind="logo"
				path={provider.logo_path}
				width={48}
				ratio={1}
				className="h-8 md:h-10 lg:h-12 w-auto rounded-lg"
				alt={provider.name}
			/>
			<span className="pl-1 pr-2 text-xs md:text-sm lg:text-base font-semibold">
				{provider.name}
			</span>
		</div>
	)
}
