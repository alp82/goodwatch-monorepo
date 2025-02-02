import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import { convertHyphensToWords } from "~/utils/string"

export type BreadcrumbsParams = {
	path: string
}

export default function Breadcrumbs({ path }: BreadcrumbsParams) {
	const parts = path.split("/").filter(Boolean)
	const items = parts.map((part, index) => {
		const itemPath = `/${parts.slice(0, index + 1).join("/")}`
		const itemLabel = convertHyphensToWords(part)
		return {
			path: itemPath,
			label: itemLabel,
		}
	})

	return (
		<div className="bg-gray-950/70">
			<div className="max-w-7xl mx-auto px-4 py-2 flex gap-2">
				{items.map((item, index) => {
					const lastItem = index === items.length - 1
					return (
						<div key={item.path} className="flex gap-2 items-center">
							{lastItem ? (
								<div className="font-semibold text-amber-400">{item.label}</div>
							) : (
								<>
									<Link to={item.path} className="font-semibold">
										{item.label}
									</Link>
									<ChevronRightIcon className="h-4 w-4" />
								</>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
