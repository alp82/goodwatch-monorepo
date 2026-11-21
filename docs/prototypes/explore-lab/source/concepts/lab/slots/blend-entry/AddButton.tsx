// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry"). The same Add as in a blend's own title: it opens
// the pantry, which shows what the blend would be called and a few of its titles before you commit. Every ingredient
// in it is a real link; nothing is replaced.
import { PlusIcon } from "@heroicons/react/20/solid"
import { useRef, useState } from "react"
import { href } from "../../../../kit/address"
import { Floating } from "../../../blend/Floating"
import { Pantry } from "../../../blend/Pantry"
import type { EntryData } from "./plus.server"
import type { EntryProps } from "./slot"

export function AddButton({
	address,
	to,
	data,
	label,
	quiet = false,
}: EntryProps & { data: EntryData; label: string; quiet?: boolean }) {
	const [open, setOpen] = useState(false)
	const button = useRef<HTMLButtonElement>(null)
	return (
		<>
			<button
				ref={button}
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={`inline-flex shrink-0 items-center gap-1 rounded-full font-sans font-bold tracking-normal text-gray-100 ring-1 outline-none transition-[background-color,box-shadow,transform,color] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.14] hover:ring-white/45 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.97] aria-expanded:bg-white aria-expanded:text-gray-950 ${
					quiet
						? "h-9 bg-transparent pr-3.5 pl-2.5 text-sm ring-white/15"
						: "h-10 bg-white/[0.07] pr-4 pl-2.5 text-base ring-white/20"
				}`}
			>
				<PlusIcon className="h-5 w-5" />
				{label}
			</button>
			<Floating
				open={open}
				onClose={() => setOpen(false)}
				anchor={button as never}
				width={940}
				label="Add an ingredient"
			>
				<Pantry
					kind={address.kind}
					address={address}
					parts={data.parts}
					isBest={false}
					groups={data.pantry}
					// The pantry's poster preview is answered by the Blend concept's own loader.
					to={(a, extra) => (extra?.peek ? href("blend", a, extra) : to(a, extra))}
				/>
			</Floating>
		</>
	)
}
