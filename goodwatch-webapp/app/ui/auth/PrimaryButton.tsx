// The sign-in card's main button, in a module of its own: the Feedback drawer uses it too, and the card's scene
// (AuthScene.tsx) brings the animation library, which the drawer must not load on every page (#236).
import type { ReactNode } from "react"
import { Spinner } from "~/ui/wait/Spinner"

export const AUTH_SUBMIT_CLASS =
	"flex w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3 font-semibold text-white shadow-lg shadow-amber-900/40 transition duration-200 hover:from-amber-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60"

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
