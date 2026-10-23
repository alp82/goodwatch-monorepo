// The account menu's places: the member's own library and taste (the private pages, where they rate, edit and
// track), then the app. The identity row on top leads to the public profile.
import {
	ArrowDownTrayIcon,
	BookmarkIcon,
	Cog6ToothIcon,
	EyeIcon,
	FingerPrintIcon,
	LifebuoyIcon,
	ListBulletIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, SVGProps } from "react"
import { SCORES_PAGE, statusPage } from "~/domain/my-library"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { myListsPath } from "~/ui/share-card/links"

export interface AccountPlace {
	label: string
	/** A shorter label for the phone grid. */
	short?: string
	to: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	count?: keyof AccountCounts
}

export interface AccountCounts {
	wishlist: number
	seen: number
	scores: number
}

export const LIBRARY_PLACES: AccountPlace[] = [
	{
		label: "Wishlist",
		to: statusPage({ status: "want" }),
		icon: BookmarkIcon,
		count: "wishlist",
	},
	{
		label: "Seen",
		to: statusPage({ status: "seen" }),
		icon: EyeIcon,
		count: "seen",
	},
	{
		label: "Your scores",
		short: "Scores",
		to: SCORES_PAGE,
		icon: StarIcon,
		count: "scores",
	},
	{ label: "My shows", short: "Shows", to: "/my-shows", icon: TvIcon },
]

export const YOU_PLACES: AccountPlace[] = [
	{ label: "Taste", to: "/taste", icon: FingerPrintIcon },
	{ label: "Lists", to: myListsPath, icon: ListBulletIcon },
]

export const SETTINGS_PLACE: AccountPlace = {
	label: "Settings",
	to: "/settings",
	icon: Cog6ToothIcon,
}

export const APP_PLACES: AccountPlace[] = [
	{ label: "Imports", to: IMPORTS_PATH, icon: ArrowDownTrayIcon },
	{ label: "Use with AI", to: "/use-with-ai", icon: SparklesIcon },
	{ label: "Support", to: "/support", icon: LifebuoyIcon },
]
