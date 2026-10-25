// The way to the member's tropes, which live on their profile's Tropes tab.
import { Link } from "@remix-run/react"
import { profileTabPath } from "~/ui/profile/links"
import { PANEL, SectionHead } from "~/ui/profile/taste/parts"

export const tropesPath = (handle: string) => `${profileTabPath(handle)}/tropes`

export function TropesLink({ handle }: { handle: string }) {
	return (
		<section id="tropes" aria-labelledby="tropes-head" className="scroll-mt-44">
			<div className={`${PANEL} p-5 sm:p-7`}>
				<SectionHead
					id="tropes-head"
					lead="Your"
					accent="tropes"
					sub="What keeps showing up in what you love."
					right={
						<Link
							to={tropesPath(handle)}
							prefetch="intent"
							className="inline-flex min-h-11 items-center text-sm font-bold text-amber-300 hover:text-amber-200"
						>
							All your tropes →
						</Link>
					}
				/>
			</div>
		</section>
	)
}
