// PROTOTYPE - throwaway (#651). Four layouts of what a finished import and its Undo say, on sample data.
//   /prototype/import-result?variant=A|B|C|D&screen=import|undo&data=1
// `data=1` tags every line with where its data comes from today, or that it needs new data. The page copies the
// settings frame (the real one needs a signed-in member); the loader reads only the sample titles' posters.
import { ArrowDownTrayIcon, AtSymbolIcon, EyeSlashIcon, FlagIcon, TvIcon, UserIcon } from "@heroicons/react/24/solid"
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { getViewerContext } from "~/server/viewer.server"
import { TITLES } from "~/ui/prototype-import-result/data"
import { PostersContext, ShowDataContext } from "~/ui/prototype-import-result/parts"
import { VARIANTS } from "~/ui/prototype-import-result/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { titleKey } from "~/utils/title-key"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	try {
		const cards = await getTitleCards(
			TITLES.map((t) => titleKey(t.mediaType, t.tmdbId)),
			await getViewerContext(request),
			NO_TASTE,
		)
		return json({ posters: Object.fromEntries(cards.map((c) => [c.tmdb_id, c.poster_path])) as Record<number, string | null> })
	} catch (error) {
		console.error("import-result prototype: posters unavailable", error)
		return json({ posters: {} as Record<number, string | null> })
	}
}

export const meta = () => [{ title: "Import result prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const NAV = [
	{ name: "Country & titles", icon: FlagIcon },
	{ name: "Streaming", icon: TvIcon },
	{ name: "Profile", icon: AtSymbolIcon },
	{ name: "Imports", icon: ArrowDownTrayIcon },
	{ name: "Hidden titles", icon: EyeSlashIcon },
	{ name: "Account", icon: UserIcon },
]
const TABS = ["IMDb", "Letterboxd", "Trakt", "Generic CSV", "MovieLens", "Kodi"]

export default function ImportResultPrototype() {
	const { posters } = useLoaderData<typeof loader>()
	const [params, setParams] = useSearchParams()
	const variantKey = params.get("variant") ?? "A"
	const screen = params.get("screen") === "undo" ? "undo" : "import"
	const showData = params.get("data") === "1"
	const variant = VARIANTS[variantKey] ?? VARIANTS.A
	const set = (key: string, value: string | null) => {
		const next = new URLSearchParams(params)
		value === null ? next.delete(key) : next.set(key, value)
		setParams(next, { replace: true, preventScrollReset: true })
	}
	const View = screen === "undo" ? variant.view.Undo : variant.view.Import
	return (
		<PostersContext.Provider value={posters}>
			<ShowDataContext.Provider value={showData}>
				<div className="mx-auto max-w-7xl px-4 py-2 sm:px-8 md:py-4 lg:py-8">
					<div className="flex flex-col gap-4 text-sm text-gray-300 sm:text-md md:text-lg lg:text-xl">
						<h1 className="my-3 text-center text-2xl font-bold tracking-tight text-gray-100 sm:my-6 sm:text-3xl md:text-4xl lg:text-5xl">Your Settings</h1>
						<hr className="mb-4 border-gray-700" />
						<div className="flex flex-wrap gap-4 lg:gap-8">
							<nav aria-label="Sidebar">
								<ul className="-mx-2 w-36 space-y-1 lg:w-48">
									{NAV.map((item) => (
										<li key={item.name}>
											<span className={`group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold ${item.name === "Imports" ? "bg-indigo-800 text-gray-50" : "text-gray-400"}`}>
												<item.icon aria-hidden className="h-6 w-6" />
												{item.name}
											</span>
										</li>
									))}
								</ul>
							</nav>
							<div className="w-full min-w-0 md:w-auto md:flex-1">
								<div className="md:px-4 lg:px-8">
									<div className="flex max-w-2xl flex-col gap-6 text-base text-gray-300">
										<div className="flex flex-wrap items-center gap-2 rounded-full bg-white px-2 py-1.5 text-sm font-semibold text-black ring-2 ring-fuchsia-500 self-start">
											<span className="px-2">Prototype</span>
											{(["import", "undo"] as const).map((s) => (
												<button
													key={s}
													type="button"
													onClick={() => set("screen", s === "import" ? null : s)}
													className={`rounded-full px-3 py-1 ${screen === s ? "bg-black text-white" : "hover:bg-neutral-200"}`}
												>
													{s === "import" ? "After import" : "After Undo"}
												</button>
											))}
											<button type="button" onClick={() => set("data", showData ? null : "1")} className={`rounded-full px-3 py-1 ${showData ? "bg-fuchsia-600 text-white" : "hover:bg-neutral-200"}`}>
												Data sources
											</button>
										</div>
										<div>
											<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">Import your library</h2>
											<p className="mt-2 text-gray-400">Bring your ratings and activity into GoodWatch. Choose where your export comes from, preview it, and decide what to import.</p>
										</div>
										<div className="grid grid-cols-3 rounded-lg border border-slate-700 bg-slate-900 p-1">
											{TABS.map((tab) => (
												<span key={tab} className={`min-h-11 rounded-md px-2 py-2 text-center font-semibold ${tab === "Generic CSV" ? "bg-indigo-700 text-white" : "text-gray-300"}`}>
													{tab}
												</span>
											))}
										</div>
										<View key={`${variantKey}-${screen}`} />
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))} />
			</ShowDataContext.Provider>
		</PostersContext.Provider>
	)
}
