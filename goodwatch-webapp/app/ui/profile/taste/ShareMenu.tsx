// The Stats tab's Share button in the profile header: a dropdown of the tab's share cards (the link-preview images of
// /u/<handle>/stats and its sections), each with the button that shares its address. Only cards whose parts everyone
// may see are offered, since a shared card draws what a signed-out visitor sees.
import { ShareIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { type ProfilePart, type ProfileShell, canSee } from "~/domain/profile"
import { ogImageUrl } from "~/utils/og-image-url"
import { profileTabPath } from "../links"
import { QUIET_BUTTON, ShareButton } from "../parts"

const CARDS: { name: string; path: string; parts: ProfilePart[] }[] = [
	{ name: "Viewer type", path: "", parts: ["taste"] },
	{ name: "Vs everyone", path: "/everyone", parts: ["taste", "scores"] },
	{ name: "Taste groups", path: "/sides", parts: ["taste"] },
]

/** The card image's address on this host: the card route serves every host the same card. */
const cardImage = (page: string) => {
	const url = new URL(ogImageUrl(`https://goodwatch.app${page}`))
	return `${url.pathname}${url.search}`
}

export function ShareMenu({ shell }: { shell: ProfileShell }) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const onDown = (e: PointerEvent) => {
			if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false)
		}
		window.addEventListener("pointerdown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [open])
	const cards = CARDS.filter((c) =>
		c.parts.every((part) => canSee(shell.visibility, part, "guest")),
	)
	if (!cards.length) return null
	const tab = profileTabPath(shell.handle, "stats")
	return (
		<div ref={box} className="relative">
			<button
				type="button"
				aria-expanded={open}
				aria-haspopup="true"
				onClick={() => setOpen((o) => !o)}
				className={`${QUIET_BUTTON} cursor-pointer`}
			>
				<ShareIcon className="size-4" aria-hidden />
				Share
			</button>
			{open && (
				<div className="absolute top-full right-0 z-40 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl bg-gray-900 p-3 shadow-2xl ring-1 ring-white/15">
					{cards.map((c) => (
						<figure
							key={c.name}
							className="overflow-hidden rounded-xl bg-gray-950 ring-1 ring-white/10"
						>
							<img
								src={cardImage(`${tab}${c.path}`)}
								alt={`${c.name} share card for @${shell.handle}`}
								width={1200}
								height={630}
								className="aspect-[1200/630] h-auto w-full bg-white/5 object-cover"
							/>
							<figcaption className="flex items-center justify-between gap-3 px-3 py-2">
								<span className="text-sm font-semibold text-gray-200">
									{c.name}
								</span>
								<ShareButton
									handle={shell.handle}
									path={`/stats${c.path}`}
									label="Share"
									className={`${QUIET_BUTTON} cursor-pointer`}
								/>
							</figcaption>
						</figure>
					))}
				</div>
			)}
		</div>
	)
}
