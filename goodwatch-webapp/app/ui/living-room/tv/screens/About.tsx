// What is GoodWatch? One sentence, one line and two answers: back to where the person was, or into the taste quiz.
// It has no page to grow into, so no Expand key. A chunk the TV asks for at the first interaction
// (screen-code.tsx).
//
// On the phone the two answers are touch targets, 44 px or more on the phone's screen (`keySize` in kit.tsx), and
// the words start under the bar's keys, which are touch targets too.
import {
	CornerBar,
	Item,
	PHONE_HEAD,
	Shade,
	useKeySize,
	usePhone,
} from "../kit"

const ANSWERS = [
	{ id: "got-it", label: "Got it" },
	{ id: "rate", label: "Rate what I've seen" },
]

export default function About({ items }: { items: readonly string[] }) {
	const P = usePhone()
	const height = useKeySize(52)
	return (
		<>
			<Shade dim={0.82} />
			{/* The phone's header names the screen, so its content starts with the headline. */}
			<div
				className={`absolute inset-x-0 bottom-0 flex flex-col justify-center ${P ? "px-4 pb-2.5" : "top-0 px-14 pt-16"}`}
				style={P ? { top: PHONE_HEAD } : undefined}
			>
				{!P && (
					<div className="text-[24px] font-bold uppercase tracking-[0.16em] text-white/75">
						What is GoodWatch?
					</div>
				)}
				<div
					className={`font-bold leading-[1.05] tracking-tight ${P ? "" : "mt-2"}`}
					style={{ fontSize: P ? 27 : 60 }}
				>
					One score, how it feels, where it streams.
				</div>
				<div
					className={`text-white/80 ${P ? "mt-1.5 text-[17px] leading-[20px]" : "mt-3 text-[30px]"}`}
				>
					IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account
					needed.
				</div>
				<div
					className={`grid grid-cols-2 ${P ? "mt-2.5 gap-2" : "mt-10 gap-5"}`}
				>
					{ANSWERS.filter((answer) => items.includes(answer.id)).map((a) => (
						<Item
							key={a.id}
							id={a.id}
							className={`tvc-btn flex items-center justify-center whitespace-nowrap px-4 text-center leading-tight ${P ? "text-[19px]" : "h-[116px] rounded-[26px] text-[32px]"}`}
							style={P ? { height } : undefined}
						>
							{a.label}
						</Item>
					))}
				</div>
			</div>
			<CornerBar items={items} />
		</>
	)
}
