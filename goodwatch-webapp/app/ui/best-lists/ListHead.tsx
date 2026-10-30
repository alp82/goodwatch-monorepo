// The head of a best-of list and of the people list: the heading and the intro. Explore's tab row names the page, so
// there is no visible breadcrumb; the best-of lists keep their BreadcrumbList in the page's meta.
import type { ReactNode } from "react"

export function ListHead({
	heading,
	intro,
	children,
}: {
	heading: string
	intro: string
	children?: ReactNode
}) {
	return (
		<>
			<div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pt-4">
				<h1 className="text-xl font-medium text-gray-100 sm:text-2xl md:text-3xl lg:text-4xl">
					{heading}
				</h1>
				<p className="max-w-4xl text-lg text-gray-400">{intro}</p>
				{children}
			</div>
		</>
	)
}
