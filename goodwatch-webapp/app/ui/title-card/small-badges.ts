// A grid of narrow posters on phones (Discover's three across) asks its cards for smaller badges: the GoodWatch score
// tab, the actions button and the card's border shrink below the large breakpoint, so they don't cover the poster.
import { createContext, useContext } from "react"

export const SmallBadgesContext = createContext(false)

export const useSmallBadges = () => useContext(SmallBadgesContext)
