import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import { type Crumb, categoryCrumbs } from "~/ui/nav/breadcrumb-trail"

export type BreadcrumbsParams =
	| {
			/** A category page's path; each segment is an item. */
			path: string
			/** The page's own label, for the last item. */
			label?: string
			items?: never
			className?: string
	  }
	| {
			path?: never
			label?: never
			/** The trail, the current page last. */
			items: readonly Crumb[]
			className?: string
	  }

export default function Breadcrumbs({
	path,
	label,
	items: given,
	className = "",
}: BreadcrumbsParams) {
	const items = given ?? categoryCrumbs(path, label)

	return (
		<nav aria-label="Breadcrumb" className={`bg-gray-950/70 ${className}`}>
			<ol className="max-w-7xl mx-auto px-4 py-2 flex gap-2">
				{items.map((item, index) => {
					const lastItem = index === items.length - 1
					return (
						<li
							key={item.path}
							className={`flex gap-2 items-center ${lastItem ? "min-w-0" : "shrink-0"}`}
						>
							{lastItem ? (
								<span
									aria-current="page"
									className="font-semibold text-amber-400 truncate"
								>
									{item.label}
								</span>
							) : (
								<>
									<Link to={item.path} className="font-semibold">
										{item.label}
									</Link>
									<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
								</>
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
