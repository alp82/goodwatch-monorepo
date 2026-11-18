// The one primary button: the flat amber pill inside the app, the amber-700 rectangle on info pages and the
// sign-in and sign-up cards. A view has one filled amber button, its main action; its other amber buttons are
// outlines in the same shape: `outline` next to pills, `outlineRect` next to rectangles. The look is fill, text color,
// weight and corners only; each place keeps its own height, padding, gap and text size through `className`.
import { Link, type LinkProps } from "@remix-run/react"
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react"

export type PrimaryButtonVariant = "pill" | "rect" | "outline" | "outlineRect"

const OUTLINE =
	"bg-transparent text-amber-300 ring-1 ring-inset ring-amber-400/55 transition-colors not-disabled:hover:bg-amber-400/12"

const LOOK: Record<PrimaryButtonVariant, string> = {
	pill: "rounded-full bg-amber-400 font-bold text-gray-950 transition-colors not-disabled:hover:bg-amber-300",
	rect: "rounded-lg bg-amber-700 font-semibold text-white transition-colors not-disabled:hover:bg-amber-600",
	outline: `rounded-full font-bold ${OUTLINE}`,
	outlineRect: `rounded-lg font-semibold ${OUTLINE}`,
}

/** The primary look as a class string, for elements that can't be a `<PrimaryButton>` (a motion button, say). */
export const primaryButtonClass = (variant: PrimaryButtonVariant = "pill", className = "") =>
	`${LOOK[variant]} ${className}`.trim()

type Common = { variant?: PrimaryButtonVariant; className?: string; children: ReactNode }
type AsLink = Common & Omit<LinkProps, "className" | "children">
type AsAnchor = Common &
	Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
		href: string
		to?: never
	}
type AsButton = Common &
	Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
		to?: never
		href?: never
	}

/** A Remix `Link` with `to`, a plain `<a>` with `href`, otherwise a `<button>` (type "button" unless given). */
export function PrimaryButton(props: AsLink): ReactNode
export function PrimaryButton(props: AsAnchor): ReactNode
export function PrimaryButton(props: AsButton): ReactNode
export function PrimaryButton(props: AsLink | AsAnchor | AsButton) {
	if ("to" in props && props.to !== undefined) {
		const { variant, className, ...rest } = props
		return <Link {...rest} className={primaryButtonClass(variant, className)} />
	}
	if ("href" in props && props.href !== undefined) {
		const { variant, className, children, ...rest } = props as AsAnchor
		return (
			<a {...rest} className={primaryButtonClass(variant, className)}>
				{children}
			</a>
		)
	}
	const { variant, className, type = "button", ...rest } = props as AsButton
	return <button {...rest} type={type} className={primaryButtonClass(variant, className)} />
}
