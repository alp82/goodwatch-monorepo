// The one primary button (D1): the flat amber pill inside the app, the amber-700 rectangle on info pages and the
// sign-in and sign-up cards. The look is fill, text color, weight and corners only; each place keeps its own height,
// padding, gap and text size through `className`.
import { Link, type LinkProps } from "@remix-run/react"
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react"

export type PrimaryButtonVariant = "pill" | "rect"

const LOOK: Record<PrimaryButtonVariant, string> = {
	pill: "rounded-full bg-amber-400 font-bold text-gray-950 transition-colors not-disabled:hover:bg-amber-300",
	rect: "rounded-lg bg-amber-700 font-semibold text-white transition-colors not-disabled:hover:bg-amber-600",
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
