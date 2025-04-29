import type React from "react"

interface DrawerProps {
	open: boolean
	onClose: () => void
	children: React.ReactNode
	className?: string
}

/**
 * A reusable Drawer component that slides up from the bottom on mobile screens.
 * Hidden on md+ screens by default. Uses Tailwind for styling.
 */
const Drawer: React.FC<DrawerProps> = ({
	open,
	onClose,
	children,
	className = "",
}) => {
	return (
		<div
			className={`fixed inset-0 z-[100] flex items-end md:hidden transition-all duration-300 ${open ? "visible" : "invisible pointer-events-none"}`}
			aria-modal="true"
			tabIndex={-1}
		>
			{/* Overlay */}
			<div
				className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
				aria-label="Close Drawer"
				onClick={onClose}
				onKeyDown={() => {}}
			/>
			{/* Drawer content */}
			<div
				className={`relative w-full bg-gray-900 rounded-t-2xl shadow-lg px-4 pt-4 pb-16 transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"} ${className}`}
				style={{ minHeight: "120px", maxHeight: "80vh", overflowY: "auto" }}
			>
				{/* Close handle */}
				<div className="flex justify-center mb-2">
					<div className="w-12 h-1.5 rounded-full bg-gray-600" />
				</div>
				{children}
			</div>
		</div>
	)
}

export default Drawer
