import type { MetaFunction } from "@remix-run/node";
import React from "react";
import { useSetUserSettings } from "~/routes/api.user-settings.set";

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	};
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Settings | GoodWatch" },
		{
			description:
				"User Settings at GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		},
	];
};

export default function Settings() {
	const setUserSettings = useSetUserSettings();
	const handleResetOnboardingFlag = () => {
		setUserSettings.mutate({
			settings: {
				onboarding_status: "incomplete",
			},
		});
	};

	return (
		<div className="max-w-7x mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
			<div className="text-lg lg:text-2xl text-gray-300">
				<h1 className="my-6 sm:my-12 font-bold tracking-tight text-center text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
					Your Settings
				</h1>

				<hr className="mb-8 border-gray-700" />

				<button
					type="button"
					className="
							flex items-center gap-2 mx-auto px-4 py-2
							border border-gray-700 rounded-md bg-gray-700 hover:bg-indigo-800
							text-base font-medium text-gray-200 hover:text-white
						"
					onClick={handleResetOnboardingFlag}
				>
					Select my{" "}
					<span>
						<span className="font-extrabold text-emerald-500">Country</span>,
					</span>
					<span className="font-extrabold text-sky-500">Streaming</span> and{" "}
					<span className="font-extrabold text-rose-500">Scores</span>
				</button>
			</div>
		</div>
	);
}
