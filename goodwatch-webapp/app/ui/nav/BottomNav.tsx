import { CubeIcon, FilmIcon, HomeIcon, TvIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import type { ComponentType, HTMLAttributes } from "react"

export default function BottomNav() {
	const location = useLocation()

	const createButton = (
		title: string,
		Icon: ComponentType<HTMLAttributes<SVGElement>>,
		url: string,
	) => {
		const isActive = location.pathname === url
		return (
			<Link
				className={`${isActive && "bg-indigo-900"} hover:bg-indigo-800 inline-flex flex-col items-center justify-center px-5 group`}
				to={url}
				prefetch="render"
			>
				<Icon className="w-5 h-5 mb-2 text-gray-400 group-hover:text-gray-200" />
				<span className="text-sm text-gray-200 group-hover:text-gray-200">
					{title}
				</span>
			</Link>
		)
	}

	return (
		<div className="lg:hidden fixed bottom-0 left-0 z-50 w-full h-28 pb-4 border-t bg-gray-950 border-gray-800">
			<div className="grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
				{createButton("Home", HomeIcon, "/")}
				{createButton("Movies", FilmIcon, "/movies")}
				{createButton("Shows", TvIcon, "/tv-shows")}
				{createButton("Discover", CubeIcon, "/discover")}
			</div>
		</div>
	)
}
