// The trailer's mark: a red circle with a white play icon, as the title page's Trailer button and play pill show
// it (Trailer.tsx). The TV's Trailer keys draw it too, on the same white pill.
import { PlayIcon } from "@heroicons/react/24/solid"

export function TrailerMark({ size = 24, className = "" }: { size?: number; className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`flex shrink-0 items-center justify-center rounded-full bg-red-600 text-white ${className}`}
			style={{ width: size, height: size }}
		>
			<PlayIcon className="translate-x-[4%]" style={{ width: size * 0.58, height: size * 0.58 }} />
		</span>
	)
}
