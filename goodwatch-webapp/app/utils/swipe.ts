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

	const handleStart = (e: MouseEvent | TouchEvent) => {
		const x = e.touches ? e.touches[0].clientX : e.clientX
		startX.current = x
		isSwiping.current = true
	}

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isSwiping.current) return

		currentX.current = e.touches ? e.touches[0].clientX : e.clientX
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
		window.addEventListener("mousemove", handleMove)
		window.addEventListener("touchmove", handleMove)
		window.addEventListener("mouseup", handleEnd)
		window.addEventListener("touchend", handleEnd)

		return () => {
			window.removeEventListener("mousemove", handleMove)
			window.removeEventListener("touchmove", handleMove)
			window.removeEventListener("mouseup", handleEnd)
			window.removeEventListener("touchend", handleEnd)
		}
	}, [])

	return {
		swipeData,
		handleSwipeStart: handleStart,
	}
}
