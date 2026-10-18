// PROTOTYPE - throwaway (settings subpages, branch prototype/settings-subpages). The Settings subpages every variant
// links to, one per tile, and the links that keep the chosen ?variant= on every hop. Nothing saves.
import {
	ArrowDownTrayIcon,
	CpuChipIcon,
	GlobeAltIcon,
	LanguageIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TvIcon,
	UserCircleIcon,
} from "@heroicons/react/24/outline"
import { Link, useSearchParams } from "@remix-run/react"
import type { ComponentProps, ComponentType, SVGProps } from "react"

export const BASE = "/prototype/settings-pages"

export type PageSlug =
	| "where-you-watch"
	| "services"
	| "language"
	| "imports"
	| "connected-apps"
	| "discover-privacy"
	| "profile"
	| "account"

export interface PageInfo {
	slug: PageSlug
	name: string
	/** One line under the name on a tile or in a list. */
	hint: string
	/** The longer line under a subpage's heading. */
	intro: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	group: "watching" | "data" | "you"
}

export const PAGES: PageInfo[] = [
	{
		slug: "where-you-watch",
		name: "Watching from",
		hint: "Your country",
		intro: "Your country decides where to watch each title, which streaming services you can pick, and the age ratings you see. It doesn't change the language.",
		icon: GlobeAltIcon,
		group: "watching",
	},
	{
		slug: "services",
		name: "Your services",
		hint: "The streaming services you pay for",
		intro: "On my services keeps the titles on these, and you hear when a title you want lands on one. The list shows the services in your country.",
		icon: TvIcon,
		group: "watching",
	},
	{
		slug: "language",
		name: "Show titles in",
		hint: "The language of titles, posters and descriptions",
		intro: "Title names, posters, descriptions and taglines show in this language when a translation exists. Menus stay in English.",
		icon: LanguageIcon,
		group: "watching",
	},
	{
		slug: "discover-privacy",
		name: "Discover and privacy",
		hint: "How Discover orders titles, and cookies",
		intro: "Choose whether Discover lifts titles that match your taste, and whether GoodWatch may use cookies.",
		icon: SparklesIcon,
		group: "watching",
	},
	{
		slug: "imports",
		name: "Imports",
		hint: "Ratings and watches from IMDb, Letterboxd and more",
		intro: "Bring your ratings, watches, and Want to See from another site or app. GoodWatch shows you everything before your library changes.",
		icon: ArrowDownTrayIcon,
		group: "data",
	},
	{
		slug: "connected-apps",
		name: "Connected apps",
		hint: "Assistants that can reach your GoodWatch",
		intro: "Claude, ChatGPT and other assistants you allowed to read or change your GoodWatch.",
		icon: CpuChipIcon,
		group: "data",
	},
	{
		slug: "profile",
		name: "Public profile",
		hint: "Your handle and what others see",
		intro: "Your handle signs the lists you share. Others see your profile at goodwatch.app/u/your-handle.",
		icon: UserCircleIcon,
		group: "you",
	},
	{
		slug: "account",
		name: "Account and sign-in",
		hint: "Email, password and sign-in methods",
		intro: "How you sign in, your password, and starting setup again.",
		icon: ShieldCheckIcon,
		group: "you",
	},
]

export const pageOf = (slug: string) => PAGES.find((p) => p.slug === slug)

/** The current variant key, from the address. */
export function useVariant() {
	const [params] = useSearchParams()
	return params.get("variant") ?? "a"
}

/** `/prototype/settings-pages/<path>?variant=<v>`: the variant comes along on every link. */
export function useHref() {
	const variant = useVariant()
	return (path = "") => `${BASE}${path ? `/${path}` : ""}?variant=${variant}`
}

/** A Link inside the prototype; `to` is a path under the prototype base ("imports", "", "library/hidden"). */
export function PLink({ to, ...rest }: Omit<ComponentProps<typeof Link>, "to"> & { to: string }) {
	const href = useHref()
	return <Link to={href(to)} prefetch="intent" {...rest} />
}
