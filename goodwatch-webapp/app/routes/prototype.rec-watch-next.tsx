// PROTOTYPE - throwaway. Question (#176): how should Watch next work, a short ordered queue of what
// the person wants to watch soonest, one tap away from any poster, title details, and mobile?
// Seven variants on /prototype/rec-watch-next?variant=<key>, each with its own model and local state
// (localStorage, per variant). Real titles, posters, and subscription offers come from Crate read-only.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getCatalog } from "~/server/prototype-rec-watch-next.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { type ModelConfig, useWatchNext } from "~/ui/prototype-rec-watch-next/model"
import { DrawerVariant, Dock, UpNext, type VariantProps, WishlistTop } from "~/ui/prototype-rec-watch-next/variants"
import { StartHero, Stack, Tonight } from "~/ui/prototype-rec-watch-next/variants-bold"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getCatalog(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; cfg: ModelConfig; View: (p: VariantProps) => JSX.Element }> = {
	"wishlist-top": { name: "Top of Wishlist", look: "existing", cfg: { ns: "wishlist-top", cap: 5, addAt: "end", wishlistTop: true }, View: WishlistTop },
	dock: { name: "Dock", look: "existing", cfg: { ns: "dock", cap: 7, addAt: "end" }, View: Dock },
	drawer: { name: "Drawer", look: "existing", cfg: { ns: "drawer", cap: 10, addAt: "end" }, View: DrawerVariant },
	"up-next": { name: "Up next", look: "existing", cfg: { ns: "up-next", cap: 8, addAt: "end" }, View: UpNext },
	"start-hero": { name: "Start page hero", look: "bolder", cfg: { ns: "start-hero", cap: 5, addAt: "end" }, View: StartHero },
	tonight: { name: "Tonight", look: "bolder", cfg: { ns: "tonight", cap: 3, addAt: "top" }, View: Tonight },
	stack: { name: "Stack", look: "bolder", cfg: { ns: "stack", cap: 7, addAt: "end" }, View: Stack },
}

export default function WatchNextPrototype() {
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "wishlist-top"
	const v = VARIANTS[key] ?? VARIANTS["wishlist-top"]
	return (
		<>
			{/* key remounts the store when the variant changes, so each model starts from its own state */}
			<Variant key={v.cfg.ns} v={v} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, `${x.name} (${x.look})`]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right"
			/>
		</>
	)
}

function Variant({ v }: { v: (typeof VARIANTS)[string] }) {
	const { titles, demoServices } = useLoaderData<typeof loader>()
	const store = useWatchNext(titles, v.cfg)
	return <v.View titles={titles} store={store} demoServices={demoServices} />
}
