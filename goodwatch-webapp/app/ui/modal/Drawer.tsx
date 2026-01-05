import type React from "react"
import { useEffect, useRef, useState } from "react"

interface DrawerProps {
	open: boolean
	onClose: () => void
	children: React.ReactNode
	className?: string
}

/**
 * A reusable Drawer component that slides up from the bottom on mobile screens.
 * Hidden on md+ screens by default. Uses Tailwind for styling.
 * Now supports drag-to-close via the handle.
 */
const DRAG_CLOSE_THRESHOLD = 80 // px
const DRAG_UP_RESISTANCE = 0.4 // resistance factor for upward drag

const Drawer: React.FC<DrawerProps> = ({
	open,
	onClose,
	children,
	className = "",
}) => {
	const startY = useRef<number | null>(null)
	const lastY = useRef<number>(0)
	const [dragY, setDragY] = useState(0)
	const [dragging, setDragging] = useState(false)
	const [visible, setVisible] = useState(false)

	// Animate in/out and manage body scroll
	useEffect(() => {
		if (open) {
			setVisible(true)
			document.body.style.overflow = "hidden"
		} else {
			// Wait for animation before hiding and restoring scroll
			const timeout = setTimeout(() => {
				setVisible(false)
				document.body.style.overflow = ""
			}, 300)
			return () => {
				clearTimeout(timeout)
				document.body.style.overflow = ""
			}
		}
	}, [open])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			document.body.style.overflow = ""
		}
	}, [])

	const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
		setDragging(true)
		if ("touches" in e) {
			startY.current = e.touches[0].clientY
		} else {
			startY.current = e.clientY
		}
	}

	const onDragMove = (e: React.TouchEvent | React.MouseEvent) => {
		if (!dragging || startY.current === null) return
		let clientY = 0
		if ("touches" in e) {
			clientY = e.touches[0].clientY
		} else {
			clientY = e.clientY
		}
		let delta = clientY - startY.current
		// Allow dragging up, but add resistance
		if (delta < 0) {
			delta = delta * DRAG_UP_RESISTANCE / (1 + Math.abs(delta) / 120)
		}
		setDragY(delta)
		lastY.current = delta
	}

	const onDragEnd = () => {
		setDragging(false)
		if (lastY.current > DRAG_CLOSE_THRESHOLD) {
			setDragY(0)
			lastY.current = 0
			onClose()
		} else {
			setDragY(0)
			lastY.current = 0
		}
		startY.current = null
	}

	// Attach mouse events to window for mouse drag
	useEffect(() => {
		if (!dragging) return
		const move = (e: MouseEvent) => onDragMove(e as any)
		const up = () => onDragEnd()
		window.addEventListener("mousemove", move)
		window.addEventListener("mouseup", up)
		return () => {
			window.removeEventListener("mousemove", move)
			window.removeEventListener("mouseup", up)
		}
	}, [dragging])

	// Compute transform and transition
	const isOpen = open && visible
	const translateY = dragging || dragY !== 0
		? dragY
		: isOpen
			? 0
			: 999 // off-screen
	const transition = dragging ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)"

	return (
		<div
			className={`fixed inset-0 z-100 flex items-end md:hidden ${isOpen ? "visible" : "invisible pointer-events-none"}`}
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
				className={`relative w-full bg-gray-900 rounded-t-2xl shadow-lg px-4 pt-4 pb-16 ${className}`}
				style={{
					minHeight: "120px",
					maxHeight: "80vh",
					overflowY: "auto",
					transform: `translateY(${translateY}px)`,
					transition,
				}}
			>
				{/* Close handle */}
				<div
					className="flex justify-center mb-2 cursor-grab active:cursor-grabbing select-none"
					// Touch events
					onTouchStart={onDragStart}
					onTouchMove={onDragMove}
					onTouchEnd={onDragEnd}
					// Mouse events
					onMouseDown={onDragStart}
				>
					<div className="w-12 h-1.5 rounded-full bg-gray-600" />
				</div>
				{children}
			</div>
		</div>
	)
}

export default Drawer
