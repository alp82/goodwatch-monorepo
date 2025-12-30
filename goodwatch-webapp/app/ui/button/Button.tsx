import type { ComponentType, HTMLAttributes, ReactNode } from "react"

type ButtonVariant = "default" | "icon"
type ButtonSize = "xs" | "sm" | "md" | "lg"
type ButtonHighlight = "neutral" | "gray" | "stone" | "slate" | "amber" | "orange" | "yellow" | "lime" | "green" | "emerald" | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple" | "pink" | "rose" | "red"
type ButtonMode = "light" | "dark"

interface ButtonProps {
	children?: ReactNode
	icon?: ComponentType<HTMLAttributes<SVGElement>>
	iconPosition?: "left" | "right"
	variant?: ButtonVariant
	size?: ButtonSize
	highlight?: ButtonHighlight
	mode?: ButtonMode
	disabled?: boolean
	onClick?: () => void
	className?: string
	type?: "button" | "submit" | "reset"
}

const sizeClasses: Record<ButtonSize, { wrapper: string; button: string; icon: string; text: string }> = {
	xs: {
		wrapper: "p-0.5 rounded-xl",
		button: "rounded-lg px-3 py-1.5 after:inset-0.5 after:rounded-md active:after:inset-0",
		icon: "w-3 h-3",
		text: "text-xs",
	},
	sm: {
		wrapper: "p-1 rounded-2xl",
		button: "rounded-xl px-6 py-3 after:inset-1.5 after:rounded-lg active:after:inset-0.5",
		icon: "w-4 h-4",
		text: "text-sm",
	},
	md: {
		wrapper: "p-1.5 rounded-2xl",
		button: "rounded-xl px-8 py-4 after:inset-1.5 after:rounded-lg active:after:inset-1",
		icon: "w-5 h-5",
		text: "text-base",
	},
	lg: {
		wrapper: "p-2 rounded-3xl",
		button: "rounded-2xl px-10 py-5 after:inset-2 after:rounded-xl active:after:inset-1",
		icon: "w-6 h-6",
		text: "text-lg",
	},
}

const iconOnlySizeClasses: Record<ButtonSize, { wrapper: string; button: string; icon: string }> = {
	xs: {
		wrapper: "p-1 rounded-xl",
		button: "rounded-lg p-2 after:inset-0.5 after:rounded-md active:after:inset-0",
		icon: "w-3 h-3",
	},
	sm: {
		wrapper: "p-2 rounded-2xl",
		button: "rounded-xl p-4 after:inset-1.5 after:rounded-lg active:after:inset-1",
		icon: "w-4 h-4",
	},
	md: {
		wrapper: "p-2.5 rounded-2xl",
		button: "rounded-xl p-5 after:inset-2 after:rounded-lg active:after:inset-1.5",
		icon: "w-5 h-5",
	},
	lg: {
		wrapper: "p-3 rounded-3xl",
		button: "rounded-2xl p-6 after:inset-2.5 after:rounded-xl active:after:inset-2",
		icon: "w-6 h-6",
	},
}

const getHighlightClasses = (color: ButtonHighlight, mode: ButtonMode) => {
	const isLight = mode === "light"
	return {
		wrapper: isLight
			? `from-${color}-200/15 to-${color}-200/20`
			: `from-${color}-800/15 to-${color}-800/20`,
		button: isLight
			? `from-${color}-50 to-${color}-300 border-2 border-${color}-800 shadow-md shadow-gray-400/30 ring-1 ring-gray-400/30`
			: `from-${color}-800 to-${color}-900 border-2 border-${color}-200/20 shadow-md shadow-gray-600/30 ring-1 ring-gray-600/30`,
		buttonHover: isLight
			? `hover:from-${color}-100 hover:to-${color}-400 hover:ring-gray-400/70`
			: `hover:from-${color}-700 hover:to-${color}-900 hover:ring-gray-600/70`,
		after: isLight
			? `after:from-${color}-200 after:to-${color}-100`
			: `after:from-${color}-700 after:to-${color}-800`,
		afterHover: isLight
			? `hover:after:from-${color}-300 hover:after:to-${color}-200`
			: `hover:after:from-${color}-600 hover:after:to-${color}-700`,
		afterActive: isLight
			? `active:after:from-${color}-200 active:after:to-${color}-100`
			: `active:after:from-${color}-600 active:after:to-${color}-700`,
		text: isLight ? `text-${color}-900` : `text-${color}-100`,
		textActive: isLight ? `group-active:text-${color}-700` : `group-active:text-${color}-300`,
	}
}

export default function Button({
	children,
	icon: Icon,
	iconPosition = "left",
	variant = "default",
	size = "md",
	highlight = "gray",
	mode = "light",
	disabled = false,
	onClick,
	className = "",
	type = "button",
}: ButtonProps) {
	const isIconOnly = variant === "icon" || !children
	const sizes = isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]
	const colors = getHighlightClasses(highlight, mode)

	return (
		<div className={`relative inline-block bg-gradient-to-b ${colors.wrapper} ${sizes.wrapper} ${className}`}>
			<button
				type={type}
				onClick={onClick}
				disabled={disabled}
				className={`
					w-full
					group relative cursor-pointer
					bg-gradient-to-b ${colors.button}
					drop-shadow-lg
					transition-all duration-200
					${colors.buttonHover}
					active:drop-shadow-sm
					after:absolute after:bg-gradient-to-b ${colors.after}
					${colors.afterHover}
					${colors.afterActive}
					disabled:opacity-70 disabled:cursor-not-allowed
					${sizes.button}
				`}
			>
				<div className={`
					relative z-[1] flex items-center justify-center gap-2
					${colors.text} font-medium
					${colors.textActive}
					group-disabled:opacity-50
					${isIconOnly ? "" : sizeClasses[size].text}
				`}>
					{Icon && iconPosition === "left" && (
						<Icon className={isIconOnly ? iconOnlySizeClasses[size].icon : sizes.icon} />
					)}
					{children}
					{Icon && iconPosition === "right" && (
						<Icon className={isIconOnly ? iconOnlySizeClasses[size].icon : sizes.icon} />
					)}
				</div>
			</button>
		</div>
	)
}
