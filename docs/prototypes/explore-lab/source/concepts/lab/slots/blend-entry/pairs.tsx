// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry", variant "pairs"). Three ready partners under the
// title, from three different families, each one click: "+ Comedy", "+ 1990s", "+ Japan". The fourth opens the
// pantry for everything else.
import { Link } from "@remix-run/react"
import { PlusIcon } from "@heroicons/react/20/solid"
import { add } from "../../../../kit/address"
import { PlaceMark } from "../../../../kit/ui"
import { nice } from "../../../blend/parts"
import { phrase, phraseText } from "../../../blend/phrase"
import type { SlotVariant } from "../../contract"
import { AddButton } from "./AddButton"
import type { EntryData } from "./plus.server"
import type { EntryProps } from "./slot"

function View({ data, address, to }: EntryProps & { data?: EntryData | null }) {
	if (!data) return null
	return (
		<div className="flex basis-full flex-wrap items-center gap-2 font-sans text-sm tracking-normal">
			<span className="mr-1 font-semibold text-gray-400">Goes well with</span>
			{data.partners.map((p) => (
				<Link
					key={`${p.family}:${p.slug}`}
					to={to(add(address, p))}
					prefetch="intent"
					title={phraseText(phrase(address.kind, [...data.parts, p]))}
					className="group flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] pr-3.5 pl-2 font-bold text-gray-100 ring-1 ring-white/15 outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-white/[0.14] hover:ring-white/45 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.97]"
				>
					<PlusIcon className="h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:rotate-90 group-hover:text-white motion-reduce:group-hover:rotate-0" />
					<PlaceMark place={p} size={13} />
					<span className={p.family === "decade" ? "tabular-nums" : ""}>{nice(p)}</span>
				</Link>
			))}
			<AddButton address={address} to={to} data={data} label="Something else" quiet />
		</div>
	)
}

export const variant: SlotVariant<never, EntryProps & { data?: EntryData | null }> = {
	id: "pairs",
	name: "Goes well with",
	what: "Three ready partners under the title, each one click to that blend, and a fourth that opens the pantry for anything else.",
	order: 2,
	View,
}
