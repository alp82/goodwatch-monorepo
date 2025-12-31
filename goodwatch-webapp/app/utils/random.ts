import React from "react"

export const random = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min)) + min

export const seededRandomSin = (seed: number) => {
	const x = Math.sin(seed) * 10000
	return x - Math.floor(x)
}

// Xorshift-based seeded random with better distribution
export const seededRandomXorshift = (seed: number) => {
	// Convert seed to 32-bit integer
	let x = seed | 0
	x ^= x << 13
	x ^= x >> 17
	x ^= x << 5
	return Math.abs(x) / 2147483647
}

// String-based seeded random using hash function
export const seededRandomFromString = (seed: string) => {
	// Simple string hash function
	let hash = 0
	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i)
		hash = ((hash << 5) - hash) + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return seededRandomXorshift(hash)
}

export const randomEdge = (min: number, max: number, percent: number) => {
	const val = Math.random() > 0.5 ? min : max
	const rand = random(0, 100) * (percent / 100)
	return Math.floor(val + rand - rand / 2)
}

export const useRandomInterval = (callback, minDelay, maxDelay) => {
	const timeoutId = React.useRef(null)
	const savedCallback = React.useRef(callback)
	React.useEffect(() => {
		savedCallback.current = callback
	}, [callback])
	React.useEffect(() => {
		const isEnabled =
			typeof minDelay === "number" && typeof maxDelay === "number"
		if (isEnabled) {
			const handleTick = () => {
				const nextTickAt = random(minDelay, maxDelay)
				timeoutId.current = window.setTimeout(() => {
					savedCallback.current()
					handleTick()
				}, nextTickAt)
			}
			handleTick()
		}
		return () => window.clearTimeout(timeoutId.current)
	}, [minDelay, maxDelay])
	const cancel = React.useCallback(() => {
		window.clearTimeout(timeoutId.current)
	}, [])
	return cancel
}
