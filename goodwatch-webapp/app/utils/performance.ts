/**
 * Performance utilities for optimizing component behavior
 */

/**
 * Throttle function to limit how often a function can be called
 * @param func The function to throttle
 * @param limit Time in milliseconds between allowed function calls
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false
	return function(this: any, ...args: Parameters<T>) {
		if (!inThrottle) {
			func.apply(this, args)
			inThrottle = true
			setTimeout(() => {
				inThrottle = false
			}, limit)
		}
	}
}
