// The sign-in card's main button: the info pages' amber-700 rectangle (D1), full width, with a spinner while busy.
import type { ReactNode } from "react"
import { primaryButtonClass } from "~/ui/button/PrimaryButton"
import { Spinner } from "~/ui/wait/Spinner"

export const AUTH_SUBMIT_CLASS = primaryButtonClass(
	"rect",
	"flex w-full cursor-pointer items-center justify-center px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60",
)

export function PrimaryButton({
	children,
	busy,
	disabled,
	onClick,
	type = "submit",
}: {
	children: ReactNode
	busy?: boolean
	disabled?: boolean
	onClick?: () => void
	type?: "submit" | "button"
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={busy || disabled}
			aria-busy={busy || undefined}
			className={AUTH_SUBMIT_CLASS}
		>
			{busy ? <Spinner size="small" /> : children}
		</button>
	)
}
