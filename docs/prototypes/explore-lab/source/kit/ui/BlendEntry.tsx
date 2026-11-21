// PROTOTYPE - throwaway (prototype/explore-r5). The spot next to a place's title where a blend can start. The lab
// fills it with its picked "blend-entry" variant; without a provider (the round 4 concepts) it draws nothing. It lives
// in the kit so a concept's head can render it without importing the lab.
import { type ComponentType, createContext, useContext } from "react"
import type { Address } from "../address"

export interface BlendEntryProps {
	address: Address
	/** The link of an address under the concept. */
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}

export const BlendEntrySlot = createContext<ComponentType<BlendEntryProps> | null>(null)

export function BlendEntry(props: BlendEntryProps) {
	const View = useContext(BlendEntrySlot)
	return View ? <View {...props} /> : null
}
