// PROTOTYPE - throwaway. Country and display language: how the two are changed, previewed, tried and saved.
//   /prototype/media-language?variant=D|E|F|G (round two, the default) or A|B|C (round one, kept for reference)
// Round two puts a compact pair of controls in the title bar and changes the current title in place:
//   D  a small panel anchored to the pair, the page shows the draft, Save or Cancel
//   E  two independent lists in the title bar, a pick applies at once, a fixed bar offers Save and Undo
//   F  pick in a compact dialog, then Keep or Undo under the pair, on the page
//   G  an edit mode of the title bar itself, with Reset and Done
// Round one, on a copy of the title page and of the settings page:
//   A  one staged panel for both, with a before and after preview and an optional companion language
//   B  a temporary look at a country in place, saved by an inline action, and a small language control
//   C  a board that compares the outcomes (one, the other, both) and then asks for how long
// More parameters, all optional: visitor (see PERSONAS), title, page=title|settings, save=fail, look=title|visit,
// no-title=english|original, panel=open, bar=small, chrome=off. The route reads no service and writes nothing: the state is in memory and ends with a
// reload. See docs/prototypes/media-language/README.md.
import {
	type ShouldRevalidateFunction,
	useSearchParams,
} from "@remix-run/react"
import { useEffect } from "react"
import { PrototypeChrome } from "~/ui/prototype-media-language/chrome"
import {
	PERSONAS,
	TITLES,
	type TitleId,
} from "~/ui/prototype-media-language/fixtures"
import { ToastView } from "~/ui/prototype-media-language/host"
import {
	type Initial,
	StoreProvider,
	type VariantKey,
	useStore,
} from "~/ui/prototype-media-language/model"
import { VariantA } from "~/ui/prototype-media-language/variant-a"
import { VariantB } from "~/ui/prototype-media-language/variant-b"
import { VariantC } from "~/ui/prototype-media-language/variant-c"
import { VariantD } from "~/ui/prototype-media-language/variant-d"
import { VariantE } from "~/ui/prototype-media-language/variant-e"
import { VariantF } from "~/ui/prototype-media-language/variant-f"
import { VariantG } from "~/ui/prototype-media-language/variant-g"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [
	{ title: "Country and language prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

function initialOf(params: URLSearchParams): Initial {
	const variant = (params.get("variant") ?? "D").toUpperCase()
	const persona =
		PERSONAS.find((p) => p.key === params.get("visitor")) ?? PERSONAS[0]
	return {
		variant: (["A", "B", "C", "D", "E", "F", "G"].includes(variant)
			? variant
			: "D") as VariantKey,
		persona: persona.key,
		surface:
			params.get("page") === "settings" && persona.viewer === "member"
				? "settings"
				: "title",
		titleId: (TITLES.find((t) => t.id === params.get("title"))?.id ??
			TITLES[0].id) as TitleId,
		failNext: params.get("save") === "fail",
		lookScope: params.get("look") === "visit" ? "visit" : "title",
		titlePolicy: params.get("no-title") === "original" ? "original" : "english",
	}
}

// The address follows the state without a navigation, so a reload or a shared link opens the same scenario.
function AddressSync() {
	const s = useStore()
	useEffect(() => {
		const url = new URL(window.location.href)
		const set = (key: string, value: string, standard: string) =>
			value === standard
				? url.searchParams.delete(key)
				: url.searchParams.set(key, value)
		url.searchParams.set("variant", s.variant)
		set("visitor", s.persona.key, PERSONAS[0].key)
		set("title", s.titleId, TITLES[0].id)
		set("page", s.surface, "title")
		set("save", s.failNext ? "fail" : "ok", "ok")
		set("look", s.lookScope, "title")
		set("no-title", s.titlePolicy, "english")
		window.history.replaceState(window.history.state, "", url)
	}, [
		s.variant,
		s.persona.key,
		s.titleId,
		s.surface,
		s.failNext,
		s.lookScope,
		s.titlePolicy,
	])
	return null
}

function Page() {
	const s = useStore()
	return (
		<div data-variant={s.variant} className="pb-56">
			{/* The query devtools' button (development only) sits on the phone's lower right corner, over a sheet's Save. */}
			<style>{".tsqd-open-btn-container{display:none!important}"}</style>
			{/* Each variant keeps its own drafts and open panels, and loses them when another takes its place. */}
			{s.variant === "A" && <VariantA />}
			{s.variant === "B" && <VariantB />}
			{s.variant === "C" && <VariantC />}
			{s.variant === "D" && <VariantD />}
			{s.variant === "E" && <VariantE />}
			{s.variant === "F" && <VariantF />}
			{s.variant === "G" && <VariantG />}
		</div>
	)
}

export default function MediaLanguagePrototype() {
	const [params] = useSearchParams()
	return (
		<StoreProvider initial={initialOf(params)}>
			<AddressSync />
			<Page />
			<ToastView />
			{params.get("chrome") !== "off" && (
				<PrototypeChrome
					startOpen={params.get("panel") === "open"}
					startSmall={params.get("bar") === "small"}
				/>
			)}
		</StoreProvider>
	)
}
