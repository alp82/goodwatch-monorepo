// My shows for a guest: the page a member has, made from the Wishlist in the guest's browser. Without an account
// there is no watch state, so the list is the shows to start; the sign-up card above it offers what tracking adds.
import { useQuery } from "@tanstack/react-query"
import type { MyShows } from "~/server/my-shows.server"
import { PageHead, WRAP } from "~/ui/my-pages/bits"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { SignUpMessage } from "~/ui/sign-up-prompt/messages"
import { request } from "~/ui/watch-next/useWatchNext"
import { useGuestInteractions } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { MyShowsPage } from "./MyShowsPage"

const WORDS: SignUpMessage = {
	title: "Sign up to keep track of your shows",
	detail:
		"Mark the episodes you watch and the next one leads this list, with new episodes as they air, on every device.",
}

const LINE =
	"The next episode of each show you are watching, then the shows you want to start."

export function GuestMyShows() {
	const interactions = useGuestInteractions()
	const { locale } = useLocale()
	const result = useQuery({
		queryKey: ["my-shows", "guest", locale.language, interactions],
		queryFn: () =>
			request<{ data: MyShows; now: number }>(
				"/api/my-shows",
				"",
				interactions,
				locale.language,
			),
	})
	const prompt = (
		<SignUpPrompt
			feature="watchNext"
			words={WORDS}
			size="card"
			className="max-w-xl"
		/>
	)
	if (result.data)
		return (
			<MyShowsPage
				data={result.data.data}
				now={result.data.now}
				notice={prompt}
			/>
		)
	// Until the guest's shows arrive, and if they never do: what the page is, and what an account adds.
	return (
		<div className="pb-24" data-guest-page>
			<PageHead name="My shows" line={LINE} />
			<div className={WRAP}>{prompt}</div>
		</div>
	)
}
