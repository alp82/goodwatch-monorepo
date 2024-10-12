import { useEffect, useRef, useState } from "react"

export interface SwipeData {
	direction: "left" | "right" | null
	distance: number
}

export const useSwipe = (onSwipeEnd?: (finalDistance: number) => void) => {
	const [swipeData, setSwipeData] = useState<SwipeData>({
		direction: null,
		distance: 0,
	})

	const startX = useRef(0)
	const currentX = useRef(0)
	const isSwiping = useRef(false)
	const swipeRef = useRef<HTMLElement | undefined>()

	const previousX = useRef(0)
	const previousTime = useRef(0)
	const velocity = useRef(0)
	const animationFrameId = useRef<number | null>(null)

	const handleStart = (e: MouseEvent | TouchEvent) => {
		const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		startX.current = currentX.current = previousX.current = clientX
		previousTime.current = performance.now()
		isSwiping.current = true

		// Cancel any ongoing animation
		if (animationFrameId.current) {
			cancelAnimationFrame(animationFrameId.current)
			animationFrameId.current = null
		}
	}

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isSwiping.current) return

		const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		currentX.current = clientX

		const currentTime = performance.now()
		const deltaX = currentX.current - previousX.current
		const deltaTime = currentTime - previousTime.current

		// Calculate velocity in pixels per millisecond
		velocity.current = deltaX / deltaTime

		previousX.current = currentX.current
		previousTime.current = currentTime

		const totalDeltaX = currentX.current - startX.current
		const direction = totalDeltaX > 0 ? "right" : "left"

		setSwipeData({
			direction,
			distance: totalDeltaX,
		})
	}

	const continueSwipe = (timestamp: number) => {
		const deltaTime = timestamp - previousTime.current
		previousTime.current = timestamp

		const friction = 0.01 // Adjust this value to control deceleration

		// Apply friction to velocity
		if (velocity.current > 0) {
			velocity.current = Math.max(0, velocity.current - friction * deltaTime)
		} else {
			velocity.current = Math.min(0, velocity.current + friction * deltaTime)
		}

		// Update position
		const deltaX = velocity.current * deltaTime
		currentX.current += deltaX

		const totalDeltaX = currentX.current - startX.current
		const direction = totalDeltaX > 0 ? "right" : "left"

		setSwipeData({
			direction,
			distance: totalDeltaX,
		})

		// Stop animation when velocity is negligible
		if (Math.abs(velocity.current) < 0.1) {
			if (onSwipeEnd) {
				onSwipeEnd(totalDeltaX)
			}
			setSwipeData({
				direction: null,
				distance: 0,
			})
			if (animationFrameId.current) {
				cancelAnimationFrame(animationFrameId.current)
				animationFrameId.current = null
			}
		} else {
			animationFrameId.current = requestAnimationFrame(continueSwipe)
		}
	}

	const handleEnd = () => {
		isSwiping.current = false

		// Start momentum animation if velocity is significant
		if (Math.abs(velocity.current) > 0) {
			previousTime.current = performance.now()
			animationFrameId.current = requestAnimationFrame(continueSwipe)
		} else {
			setSwipeData({
				direction: null,
				distance: 0,
			})
			if (onSwipeEnd) {
				onSwipeEnd(0)
			}
		}
	}

	useEffect(() => {
		const element = swipeRef.current
		if (!element) return

		element.addEventListener("mousedown", handleStart)
		element.addEventListener("touchstart", handleStart)
		element.addEventListener("mousemove", handleMove)
		element.addEventListener("touchmove", handleMove)
		element.addEventListener("mouseup", handleEnd)
		element.addEventListener("touchend", handleEnd)

		return () => {
			element.removeEventListener("mousedown", handleStart)
			element.removeEventListener("touchstart", handleStart)
			element.removeEventListener("mousemove", handleMove)
			element.removeEventListener("touchmove", handleMove)
			element.removeEventListener("mouseup", handleEnd)
			element.removeEventListener("touchend", handleEnd)

			// Cancel any ongoing animation on unmount
			if (animationFrameId.current) {
				cancelAnimationFrame(animationFrameId.current)
			}
		}
	}, [])

	return {
		swipeData,
		swipeRef,
	}
}
