// My movies (#385) is the Watch next page for the Wishlist's movies, with one more choice, "How long?". The page's
// parts read from here whether they are drawn on My movies, to say "movie" and "My movies" where Watch next says
// "title" and "Wishlist", and take the time choice's pieces from the route that owns them (ui/my-movies/).
import { type ReactNode, createContext, useContext } from "react"
import type { WatchNext } from "~/server/watch-next.server"

export interface MoviesPageParts {
	/** The page's head: its name, how many movies, and the way to My library. */
	head: (data: WatchNext | null) => ReactNode
	/** "How long?" in the desktop strip. */
	timeControl: (
		time: number | null,
		setTime: (time: number | null) => void,
	) => ReactNode
	/** "How long?" on phones: what its button in the slab shows, and its drawer. */
	phoneTime: {
		label: (time: number | null) => string
		icon: (time: number | null) => ReactNode
		drawer: (
			time: number | null,
			setTime: (time: number | null) => void,
		) => ReactNode
	}
}

export const MoviesPageContext = createContext(false)

/** True on My movies. */
export const useMoviesPage = () => useContext(MoviesPageContext)
