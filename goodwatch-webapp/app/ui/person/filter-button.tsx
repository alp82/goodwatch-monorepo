import type { ComponentProps } from "react"
import { useNavigate } from "@remix-run/react"
import type { To } from "react-router-dom"
import { useHydrated } from "../../utils/hydrated"

/** A filter is an action, including after hydration: never advertise its combinations as crawlable links. */
export function PersonFilterButton({
	to,
	preventScrollReset,
	className = "",
	...props
}: Omit<ComponentProps<"button">, "onClick"> & {
	to: To
	preventScrollReset?: boolean
}) {
	const hydrated = useHydrated()
	const navigate = useNavigate()
	return (
		<button
			{...props}
			type="button"
			className={`text-left ${className}`}
			disabled={!hydrated || props.disabled}
			onClick={() => navigate(to, { preventScrollReset })}
		/>
	)
}
