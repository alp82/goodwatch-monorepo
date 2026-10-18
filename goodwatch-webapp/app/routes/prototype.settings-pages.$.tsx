// PROTOTYPE (development only, left out of production builds by PROTOTYPES in vite.config.js; branch
// prototype/settings-subpages). Settings where every tile is one link to a full subpage instead of a sheet, Imports
// rebuilt from the Taste start's import step, and Hidden titles moved into My library. Fake member data with the real
// country, service and language lists; nothing saves.
//   /prototype/settings-pages?variant=a|b|c           the Settings page
//   /prototype/settings-pages/<page>?variant=a|b|c    a subpage: where-you-watch, language, discover-privacy, imports,
//                                                     connected-apps, profile, account
//   /prototype/settings-pages/library/hidden          Hidden titles as a My library page (same in every variant)
// ← and → switch variants. Add &shot to hide the switcher for screenshots.
import type { MetaFunction } from "@remix-run/node"
import { useParams, useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { LibraryHidden } from "~/ui/prototype-settings-pages/LibraryHidden"
import { VariantA } from "~/ui/prototype-settings-pages/VariantA"
import { VariantB } from "~/ui/prototype-settings-pages/VariantB"
import { VariantC } from "~/ui/prototype-settings-pages/VariantC"
import { pageOf } from "~/ui/prototype-settings-pages/pages"
import { PrefsProvider } from "~/ui/prototype-settings-pages/parts"

export const meta: MetaFunction = () => [{ title: "Settings pages prototype | GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = {
	a: "Tiles to pages",
	b: "Side list",
	c: "Chapters",
}

export default function SettingsPagesPrototype() {
	const path = useParams()["*"] ?? ""
	const [params] = useSearchParams()
	const raw = params.get("variant") ?? "a"
	const key = raw in VARIANTS ? raw : "a"
	if (path === "library/hidden") return <LibraryHidden />
	const slug = pageOf(path)?.slug ?? null
	return (
		<PrefsProvider>
			{key === "a" && <VariantA slug={slug} />}
			{key === "b" && <VariantB slug={slug} />}
			{key === "c" && <VariantC slug={slug} />}
			{!params.has("shot") && <PrototypeSwitcher variants={VARIANTS} position="bottom-20 left-1/2 -translate-x-1/2 md:bottom-6" />}
		</PrefsProvider>
	)
}
