// PROTOTYPE - throwaway. The sections of the Taste page, in subnav order: each section's view.
import { useSearchParams } from "@remix-run/react"
import type { ComponentType } from "react"
import type { View3Props } from "./kit3"
import { SECTION_META, type SectionMeta } from "./meta"
import Canon from "./sections/Canon"
import Eras from "./sections/Eras"
import Moods from "./sections/Moods"
import Overview from "./sections/Overview"
import People from "./sections/People"
import { variantFor } from "./variants"

function SidesSection({ data }: View3Props) {
	const [params] = useSearchParams()
	const V = variantFor("sides", params.get("variant")).View
	return <V data={data} />
}

function CrowdSection({ data }: View3Props) {
	const [params] = useSearchParams()
	const V = variantFor("crowd", params.get("variant")).View
	return <V data={data} />
}

const VIEWS: Record<string, ComponentType<View3Props>> = {
	overview: Overview,
	sides: SidesSection,
	crowd: CrowdSection,
	canon: Canon,
	eras: Eras,
	moods: Moods,
	people: People,
}

export type SectionDef = SectionMeta & { View: ComponentType<View3Props> }

export const SECTIONS: SectionDef[] = SECTION_META.map((m) => ({
	...m,
	View: VIEWS[m.id],
}))
