// The owner's way to bring ratings or a watchlist in from another service (Settings > Imports), with the import sources'
// own logos.
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { assetUrl } from "~/utils/asset-url"
import { AMBER_BUTTON } from "./parts"

const SHOWN = ["letterboxd", "imdb", "trakt", "myanimelist", "tvtime"]
const LOGOS = SHOWN.flatMap((id) => {
	const source = IMPORT_SOURCE_LIST.find((s) => s.id === id)
	return source?.logo ? [{ id, logo: source.logo }] : []
})

export function ImportCta({ what }: { what: "ratings" | "wishlist" }) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-linear-to-r from-amber-400/[0.08] to-transparent p-4 ring-1 ring-amber-400/20">
			<span className="flex -space-x-1.5" aria-hidden>
				{LOGOS.map(({ id, logo }) => (
					<span
						key={id}
						className="flex size-9 items-center justify-center rounded-full bg-gray-900 ring-2 ring-gray-950"
					>
						<img
							src={assetUrl(logo)}
							alt=""
							className="size-5 object-contain"
						/>
					</span>
				))}
			</span>
			<p className="min-w-[14rem] flex-1 text-sm text-gray-300">
				{what === "ratings" ? (
					<>
						<b className="text-white">Rated titles somewhere else?</b> Bring
						your scores from Letterboxd, IMDb, Trakt and more. Every import
						sharpens your taste.
					</>
				) : (
					<>
						<b className="text-white">Keeping a watchlist elsewhere?</b> Bring
						it in from Letterboxd, IMDb, Trakt, Netflix and more.
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
