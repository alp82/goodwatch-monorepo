// A title page's sub-pages: one of its sections at its own address, in the title page's frame (SubPageFrame.tsx).
// Each lives under the title's own path: /movie/693134-dune-part-two/fingerprint, /show/95396-severance/tropes.
import {
	DocumentTextIcon,
	FingerPrintIcon,
	TagIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { titlePath } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"

type Media = MovieResult | ShowResult

/** The At a glance section's name (the rail, the sub-page's heading and its <title>). */
export const AT_A_GLANCE = "At a glance"

export type SubKind = "fingerprint" | "tropes" | "at-a-glance"

export const SUB_KINDS: SubKind[] = ["fingerprint", "tropes", "at-a-glance"]

export const SUB: Record<
	SubKind,
	{
		label: string
		icon: ComponentType<{ className?: string }>
		/** The section of the title page it opens from (its id there). */
		section: string
	}
> = {
	fingerprint: {
		label: "Fingerprint",
		icon: FingerPrintIcon,
		section: "fingerprint",
	},
	tropes: { label: "Tropes", icon: TagIcon, section: "tropes" },
	"at-a-glance": {
		label: AT_A_GLANCE,
		icon: DocumentTextIcon,
		section: "at-a-glance",
	},
}

/** The title page's canonical path (the one its loader redirects to). */
export const titlePagePath = (media: Media) =>
	titlePath(
		media.mediaType,
		media.details.tmdb_id,
		canonicalMediaTitle(media.details),
	)

/** The address of one of the title's sub-pages. */
export const subPagePath = (kind: SubKind, media: Media) =>
	`${titlePagePath(media)}/${kind}`

const SUB_PATH =
	/^\/(movie|show)\/([^/]+)\/(fingerprint|tropes|at-a-glance)\/?$/

/** Which sub-page an address is, or null. */
export function subKindOf(pathname: string): SubKind | null {
	const m = SUB_PATH.exec(pathname)
	return m ? (m[3] as SubKind) : null
}

/** The title page a sub-page's address belongs to, or null. */
export function titlePathOf(pathname: string): string | null {
	const m = SUB_PATH.exec(pathname)
	return m ? `/${m[1]}/${m[2]}` : null
}

/** What a sub-page shows of its title. */
export interface TitleInfo {
	type: "movie" | "show"
	id: number
	title: string
	year: number | null
	poster: string | null
	backdrop?: string | null
	/** The title page's path. */
	path: string
}

export const titleInfoOf = (media: Media): TitleInfo => ({
	type: media.mediaType,
	id: media.details.tmdb_id,
	title: media.details.title,
	year: Number(media.details.release_year) || null,
	poster: media.details.poster_path,
	backdrop: media.details.backdrop_path,
	path: titlePagePath(media),
})
