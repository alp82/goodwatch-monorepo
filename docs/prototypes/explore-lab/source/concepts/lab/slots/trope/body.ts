// PROTOTYPE - throwaway (prototype/explore-r9). What a trope page body (slot "trope-body") gets.
import type { ReactNode } from "react"
import type { Example, TropePageData } from "../tropes/model"

export interface BodyProps {
	d: TropePageData
	/** The examples, strongest first (frame.tsx `strongest`). */
	cases: Example[]
	/** "movies", "shows", "movies and shows". */
	noun: string
	/** The page-level spoiler switch, when that treatment is picked; the body puts it by its heading. */
	tools?: ReactNode
}
