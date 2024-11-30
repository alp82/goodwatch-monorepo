import type { MetaFunction } from "@remix-run/node";
import React from "react";
import { useSetUserSettings } from "~/routes/api.user-settings.set";
import SelectStreaming from "~/ui/onboarding/SelectStreaming";
import StreamingProviderSelection from "~/ui/onboarding/StreamingProviderSelection";
import { useSupabase, useUser } from "~/utils/auth";

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	};
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Streaming Settings | GoodWatch" },
		{
			description:
				"Change your GoodWatch streaming settings. All movie and tv show ratings and streaming providers on the same page",
		},
	];
};

export default function SettingsStreaming() {
	const { user, loading } = useUser();
	const { supabase } = useSupabase();

	const handleSubmit = () => {
		console.log("submit");
	};

	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex flex-col gap-4 text-lg lg:text-2xl text-gray-300">
				<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
					Streaming
				</h2>

				<SelectStreaming />
			</div>
		</div>
	);
}
