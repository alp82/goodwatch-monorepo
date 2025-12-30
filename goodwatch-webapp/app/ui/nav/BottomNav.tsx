import { CubeIcon, FilmIcon, FingerPrintIcon, HomeIcon, TvIcon } from "@heroicons/react/24/solid"
import { Link, useLocation } from "@remix-run/react"
import type { ComponentType, HTMLAttributes } from "react"

export default function BottomNav() {
	const location = useLocation()

	const createButton = (
		title: string,
		Icon: ComponentType<HTMLAttributes<SVGElement>>,
		url: string,
	) => {
		const isActive = location.pathname.startsWith(url) && url !== "/" || location.pathname === url
		return (
			<Link
				className={`${isActive && "bg-gray-800"} hover:bg-gray-700 inline-flex flex-col items-center justify-center pt-2 pb-4 px-3 group`}
				to={url}
				prefetch="render"
			>
				<Icon className={`w-5 h-5 mb-1 ${isActive ? "text-amber-600" : "text-gray-400"} group-hover:text-gray-200`} />
				<span className="text-xs text-gray-200 group-hover:text-gray-200">
					{title}
				</span>
			</Link>
		)
	}

	const isTasteActive = location.pathname.startsWith("/taste")

	return (
		<div className="lg:hidden fixed bottom-0 left-0 z-50 w-full border-t bg-gray-950 border-gray-800">
			<div className="relative grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
				{createButton("Home", HomeIcon, "/")}
				{createButton("Discover", CubeIcon, "/discover")}
				{createButton("Movies", FilmIcon, "/movies")}
				{createButton("Shows", TvIcon, "/shows")}
			</div>
			{/* FAB Center Button for Taste */}
			<Link
				to="/taste"
				prefetch="render"
				className={`absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
					isTasteActive 
						? "bg-amber-600 ring-4 ring-amber-600/30" 
						: "bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600"
				}`}
			>
				<FingerPrintIcon className="w-7 h-7 text-white" />
			</Link>
		</div>
	)
}
