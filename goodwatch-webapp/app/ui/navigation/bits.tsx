// Small pieces shared by the header, the dock and the command palette: the new-episodes mark and the Sign up link.
import type { SignalWords } from "~/domain/new-episodes-signal"
import { useAuthHref } from "~/utils/auth-href"

export const tmdbImage = (path: string, size: "w92" | "w300" | "w342") =>
	`https://image.tmdb.org/t/p/${size}${path}`

/**
 * The signal that something new aired for the member's shows (#442), or landed on their services (#456): a number,
 * on the Watch key of the header and the dock. Sky blue, the colour of the "New episodes" tag on Up next; amber stays
 * "you are here". Draws nothing when nothing is new.
 */
export function NewEpisodesMark({
	words,
	className = "",
}: { words: SignalWords | null; className?: string }) {
	if (!words) return null
	return (
		<span
			data-new-episodes
			className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-400 px-1.5 text-[11.5px] font-black tabular-nums leading-none text-black ring-2 ring-gray-950 ${className}`}
		>
			<span aria-hidden>{words.badge}</span>
			<span className="sr-only">{words.door}</span>
		</span>
	)
}

/** Sign up, bringing the person back to the page they're on. Guest progress transfers as usual. */
export function useSignUpHref() {
	return useAuthHref()("sign-up")
}
