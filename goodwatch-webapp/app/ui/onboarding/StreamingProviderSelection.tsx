import React from "react";
import type { StreamingProvider } from "~/server/streaming-providers.server";

interface StreamingProviderSelectionProps {
	provider: StreamingProvider;
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
			<img
				className="h-12 rounded-lg"
				src={`https://www.themoviedb.org/t/p/original/${provider.logo_path}`}
				alt={provider.name}
			/>
			<span className="pl-1 pr-2 text-sm font-semibold">{provider.name}</span>
		</div>
	);
}
