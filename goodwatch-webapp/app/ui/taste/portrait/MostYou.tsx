// "The titles that are most you": the member's most telling titles as poster cards, two rows of eight on wide
// screens, two rows of four on tablets and two rows of three on phones.
import { ProfileCard } from "~/ui/profile/ProfileCard"
import { useTaste } from "~/ui/profile/taste/model"
import { PANEL } from "~/ui/profile/taste/parts"

export function MostYou() {
	const { taste, title } = useTaste()
	if (!taste.mostYou.length) return null
	return (
		<div className={`${PANEL} p-4 sm:p-5`}>
			<p className="mb-3 text-sm font-bold text-gray-200">
				The titles that are most you
			</p>
			<ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
				{taste.mostYou.slice(0, 16).map((key, i) => (
					<li
						key={key}
						className={i >= 8 ? "max-lg:hidden" : i >= 6 ? "max-sm:hidden" : ""}
					>
						<ProfileCard title={title(key)} />
					</li>
				))}
			</ul>
		</div>
	)
}
