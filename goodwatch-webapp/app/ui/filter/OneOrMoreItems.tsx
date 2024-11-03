import React, { type ReactNode } from "react"

export type OneOrMoreMode = "any" | "all"

interface OneOrMoreItemsParams {
	index: number
	amount: number
	mode: OneOrMoreMode
	children: ReactNode
}

export default function OneOrMoreItems({
	index,
	amount,
	mode = "any",
	children,
}: OneOrMoreItemsParams) {
	return (
		<>
			{children}
			{index === amount - 2 && (mode === "any" ? "or" : "and")}
		</>
	)
}
