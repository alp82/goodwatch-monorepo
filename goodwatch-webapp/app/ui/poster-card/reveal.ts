// On a touch screen the first tap on a poster lays its actions over the art; only one card at a time shows them.
// This is that one card, by a key unique to the card on the page.
import { useSyncExternalStore } from "react"

let revealed: string | null = null
const listeners = new Set<() => void>()

export function setRevealed(key: string | null) {
	if (revealed === key) return
	revealed = key
	for (const listener of listeners) listener()
}

export const getRevealed = () => revealed

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/** Whether this card shows its tap actions. */
export function useRevealed(key: string): boolean {
	return useSyncExternalStore(
		subscribe,
		() => revealed === key,
		() => false,
	)
}
