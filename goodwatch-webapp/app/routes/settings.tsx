import { FlagIcon, TvIcon, UserIcon } from "@heroicons/react/24/solid";
import type { MetaFunction } from "@remix-run/node";
import { Link, Outlet, useMatches } from "@remix-run/react";
import React from "react";
import { useSetUserSettings } from "~/routes/api.user-settings.set";
import { Spinner } from "~/ui/wait/Spinner";
import { useUser } from "~/utils/auth";

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

const navigation = [
	{
		name: "Country",
		to: "/settings/country",
		icon: FlagIcon,
	},
	{
		name: "Streaming",
		to: "/settings/streaming",
		icon: TvIcon,
	},
	{
		name: "Account",
		to: "/settings/account",
		icon: UserIcon,
	},
];

export default function Settings() {
	const matches = useMatches();
	const route =
		matches?.length > 0 ? matches[matches.length - 1] : { pathname: "" };
	const checkIsCurrent = (to: string) => {
		return route.pathname === to;
	};

	const { user, loading } = useUser();
	if (loading) {
		return (
			<div className="max-w-7xl mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
				<div className="px-2 md:px-4 lg:px-8">
					<Spinner size="large" />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="max-w-7xl mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
				<p className="py-3 px-5 text-lg border-l-8 border-blue-700 text-blue-200 bg-blue-900">
					Please sign in to your account.
				</p>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8">
			<div className="flex flex-col gap-4 text-sm sm:text-md md:text-lg lg:text-xl text-gray-300">
				<h1 className="my-3 sm:my-6 font-bold tracking-tight text-center text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
					Your Settings
				</h1>

				<hr className="mb-4 border-gray-700" />

				<div className="flex gap-4 lg:gap-8 flex-wrap">
					<nav aria-label="Sidebar">
						<ul className="-mx-2 space-y-1 w-36 lg:w-48">
							{navigation.map((item) => {
								const isCurrent = checkIsCurrent(item.to);
								return (
									<li key={item.name}>
										<Link
											to={item.to}
											className={`
											${
												isCurrent
													? "bg-indigo-800 text-gray-50"
													: "text-gray-400 hover:bg-indigo-900 hover:text-gray-100"
											}
											group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold
										`}
										>
											<item.icon
												aria-hidden="true"
												className={`
												${
													isCurrent
														? "text-gray-50"
														: "text-gray-400 group-hover:text-gray-100"
												}
												h-6 w-6
											`}
											/>
											{item.name}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					<div className="flex-1">
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}
