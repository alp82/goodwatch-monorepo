import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False in the server's HTML and while the browser takes it over, true from then on. For what a visitor's browser
 * should have and the HTML shouldn't, such as links into an endless set of URLs that a crawler would follow.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	)
}
