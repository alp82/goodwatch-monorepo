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

	const previousX = useRef<number[]>([]) // Store last few X positions
	const previousTimes = useRef<number[]>([]) // Store corresponding timestamps
	const velocity = useRef(0)
	const animationFrameId = useRef<number | null>(null)
	const momentumOngoing = useRef(false)

	const maxHistorySize = 5 // Maximum number of data points to smooth over

	const reset = (finalDistance = 0) => {
		velocity.current = 0
		previousX.current = [] // Reset position history
		previousTimes.current = [] // Reset time history
		setSwipeData({ direction: null, distance: 0 })
		if (animationFrameId.current) {
			cancelAnimationFrame(animationFrameId.current)
			animationFrameId.current = null
		}
		if (onSwipeEnd) {
			onSwipeEnd(finalDistance)
		}
		momentumOngoing.current = false
	}

	const handleStart = (e: MouseEvent | TouchEvent) => {
		if (momentumOngoing.current) {
			reset()
		}

		const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		startX.current = currentX.current = clientX
		previousTimes.current = [performance.now()]
		previousX.current = [clientX]
		isSwiping.current = true
		velocity.current = 0
	}

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isSwiping.current) return

		const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		const currentTime = performance.now()

		currentX.current = clientX

		// Add current position and time to the history
		previousX.current.push(clientX)
		previousTimes.current.push(currentTime)

		// Keep the history size within the maximum window
		if (previousX.current.length > maxHistorySize) previousX.current.shift()
		if (previousTimes.current.length > maxHistorySize)
			previousTimes.current.shift()

		// Calculate velocity using average distance/time over multiple points
		if (previousX.current.length >= 2) {
			const totalDistance =
				previousX.current[previousX.current.length - 1] - previousX.current[0]
			const totalTime =
				previousTimes.current[previousTimes.current.length - 1] -
				previousTimes.current[0]

			if (totalTime > 0) {
				velocity.current = totalDistance / totalTime
			}
		}

		const totalDeltaX = currentX.current - startX.current
		const direction = totalDeltaX > 0 ? "right" : "left"

		setSwipeData({
			direction,
			distance: totalDeltaX,
		})
	}

	const continueSwipe = (timestamp: number) => {
		const deltaTime =
			timestamp - previousTimes.current[previousTimes.current.length - 1]
		previousTimes.current.push(timestamp)

		// Smooth velocity decay with friction
		const friction = 0.03 * (1 / Math.abs(velocity.current))
		if (velocity.current > 0) {
			velocity.current = Math.max(0, velocity.current - friction * deltaTime)
		} else {
			velocity.current = Math.min(0, velocity.current + friction * deltaTime)
		}

		// Update position based on smoothed velocity
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
			reset(totalDeltaX)
		} else {
			animationFrameId.current = requestAnimationFrame(continueSwipe)
		}
	}

	const handleEnd = () => {
		isSwiping.current = false

		if (Math.abs(velocity.current) > 0) {
			momentumOngoing.current = true
			animationFrameId.current = requestAnimationFrame(continueSwipe)
		} else {
			reset(0)
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
