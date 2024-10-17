import React, { type ReactNode } from "react"

interface OneOrMoreItemsParams {
	index: number
	amount: number
	children: ReactNode
}

export default function OneOrMoreItems({
	index,
	amount,
	children,
}: OneOrMoreItemsParams) {
	return (
		<>
			{children}
			{index < amount - 2 && ","}
			{index === amount - 2 && "&"}
		</>
	)
}
