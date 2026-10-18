// PROTOTYPE - throwaway (settings subpages). Hidden titles as a My library page (/my-library/hidden in the real
// build): the library's own head and back link, and the titles as a poster grid with Unhide under each. Settings no
// longer links here; My library's Hidden titles tile does. Fake titles; Unhide only moves the title to "Unhidden".
import { EyeIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { MY_LIBRARY, PageHead, WRAP } from "~/ui/my-pages/bits"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { HIDDEN } from "./data"

export function LibraryHidden() {
	const [unhidden, setUnhidden] = useState<string[]>([])
	const shown = HIDDEN.filter((t) => !unhidden.includes(t.key))
	return (
		<div className="overflow-x-clip pb-24">
			<PageHead
				name="Hidden titles"
				line="Titles you marked Not interested. They stay out of your recommendations. You can still find them in search."
				back={{ label: "My library", to: MY_LIBRARY }}
			/>
			<div className={`${WRAP} flex flex-col gap-6`}>
				<p className="text-sm text-gray-400">
					{shown.length} {shown.length === 1 ? "title" : "titles"} hidden
					{unhidden.length > 0 && ` · ${unhidden.length} unhidden just now`}
				</p>
				<ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
					{shown.map((t) => (
						<li key={t.key} className="flex flex-col">
							<img
								src={tmdbImageUrl(t.poster, "w185")}
								alt=""
								className="mb-2 aspect-[2/3] w-full rounded-lg object-cover opacity-60 ring-1 ring-white/10 grayscale-[40%]"
							/>
							<span className="mb-2 min-w-0">
								<span className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-gray-100" title={t.title}>{t.title}</span>
								<span className="line-clamp-2 min-h-8 text-xs leading-4 text-gray-500">
									{t.year} · hidden {t.hiddenAt}
								</span>
							</span>
							<button
								type="button"
								onClick={() => setUnhidden([...unhidden, t.key])}
								className="mt-auto inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-600 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white"
							>
								<EyeIcon className="size-4" aria-hidden /> Unhide
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}
