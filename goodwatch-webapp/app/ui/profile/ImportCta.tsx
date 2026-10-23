// The owner's way to bring ratings or a watchlist in from another service (Settings > Imports), with the import sources'
// own logos.
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import imdbLogo from "~/img/import-sources/imdb.svg?no-inline"
import letterboxdLogo from "~/img/import-sources/letterboxd.svg?no-inline"
import myanimelistLogo from "~/img/import-sources/myanimelist.svg?no-inline"
import traktLogo from "~/img/import-sources/trakt.svg?no-inline"
import tvtimeLogo from "~/img/import-sources/tvtime.svg?no-inline"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { AMBER_BUTTON } from "./parts"

const LOGOS = [
	["Letterboxd", letterboxdLogo],
	["IMDb", imdbLogo],
	["Trakt", traktLogo],
	["MyAnimeList", myanimelistLogo],
	["TV Time", tvtimeLogo],
] as const

export function ImportCta({ what }: { what: "ratings" | "wishlist" }) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-linear-to-r from-amber-400/[0.08] to-transparent p-4 ring-1 ring-amber-400/20">
			<span className="flex -space-x-1.5" aria-hidden>
				{LOGOS.map(([name, logo]) => (
					<span key={name} className="flex size-9 items-center justify-center rounded-full bg-gray-900 ring-2 ring-gray-950">
						<img src={logo} alt="" className="size-5 object-contain" />
					</span>
				))}
			</span>
			<p className="min-w-[14rem] flex-1 text-sm text-gray-300">
				{what === "ratings" ? (
					<>
						<b className="text-white">Rated titles somewhere else?</b> Bring your scores from Letterboxd, IMDb, Trakt and more. Every
						import sharpens your taste.
					</>
				) : (
					<>
						<b className="text-white">Keeping a watchlist elsewhere?</b> Bring it in from Letterboxd, IMDb, Trakt, Netflix and more.
					</>
				)}
			</p>
			<Link to={IMPORTS_PATH} className={AMBER_BUTTON}>
				<ArrowDownTrayIcon className="size-4" aria-hidden />
				{what === "ratings" ? "Import ratings" : "Import a watchlist"}
			</Link>
		</div>
	)
}
