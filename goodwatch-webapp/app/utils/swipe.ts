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

	const handleStart = (e: MouseEvent | TouchEvent) => {
		startX.current = currentX.current =
			e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		isSwiping.current = true
	}

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isSwiping.current) return

		currentX.current =
			e instanceof TouchEvent ? e.touches[0].clientX : e.clientX
		const deltaX = currentX.current - startX.current
		const direction = deltaX > 0 ? "right" : "left"

		setSwipeData({
			direction,
			distance: deltaX,
		})
	}

	const handleEnd = () => {
		const finalDistance = currentX.current - startX.current
		if (onSwipeEnd) {
			onSwipeEnd(finalDistance)
		}

		isSwiping.current = false
		setSwipeData({
			direction: null,
			distance: 0,
		})
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
		}
	}, [])

	return {
		swipeData,
		swipeRef,
	}
}
