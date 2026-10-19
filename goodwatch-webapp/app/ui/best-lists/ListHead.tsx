// The head of a best-of list and of the people list: the breadcrumb, the heading, and the intro, as on the category
// pages.
import type { ReactNode } from "react"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"

export function ListHead({
	crumbs,
	heading,
	intro,
	children,
}: {
	crumbs: readonly Crumb[]
	heading: string
	intro: string
	children?: ReactNode
}) {
	return (
		<>
			<Breadcrumbs items={crumbs} />
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
