// PROTOTYPE - throwaway. Discover redesign around mood searches and combinable tags: the Discover lab, one chosen
// variant per section (~/ui/prototype-discover-mood/lab). Data is live (guest) through the read-only proxy route; see
// ~/ui/prototype-discover-mood/kit.tsx. `?variant=` is ignored (old links with variant=lab still land here); rounds
// 1 to 5 and the lab's earlier variants live in git history. Not for production.
import type { MetaFunction } from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import { useProtoDiscover } from "~/ui/prototype-discover-mood/kit"
import { LabBar } from "~/ui/prototype-discover-mood/lab/LabBar"
import { LabShell } from "~/ui/prototype-discover-mood/lab/shell"

export const meta: MetaFunction = () => [{ title: "PROTOTYPE · Discover mood" }, { name: "robots", content: "noindex" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function PrototypeDiscoverMood() {
	const d = useProtoDiscover()
	return (
		<>
			<LabShell d={d} />
			<LabBar />
		</>
	)
}
