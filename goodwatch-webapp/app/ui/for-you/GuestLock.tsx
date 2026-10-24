// Guests: For you is for members. A plain locked message for now; the guest preview (the guest's taste print over a
// locked poster grid, with one call to action) replaces it.
import { Link } from "@remix-run/react"

export function GuestLock() {
	return (
		<div className="mx-auto max-w-md px-4 py-16 text-center" data-guest-lock="">
			<p className="text-[15px] leading-6 text-gray-300">
				Picks steered by your taste are for members.
			</p>
			<Link
				to="/taste/quiz"
				className="mt-5 inline-flex min-h-11 items-center rounded-full bg-amber-400 px-5 text-[14px] font-black text-gray-950 hover:bg-amber-300"
			>
				Take the quiz
			</Link>
		</div>
	)
}
