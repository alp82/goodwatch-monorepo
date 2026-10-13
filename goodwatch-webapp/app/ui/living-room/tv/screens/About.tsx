// What is GoodWatch? One sentence, one line and two answers: back to where the person was, or into the taste quiz.
// It has no page to grow into, so no Expand key. A chunk the TV asks for at the first interaction
// (screen-code.tsx).
import { CornerBar, Item, Shade, usePhone } from "../kit"

const ANSWERS = [
	{ id: "got-it", label: "Got it" },
	{ id: "rate", label: "Rate what I've seen" },
]

export default function About({ items }: { items: readonly string[] }) {
	const P = usePhone()
	return (
		<>
			<Shade dim={0.82} />
			<div
				className={`absolute inset-0 flex flex-col justify-center ${P ? "px-5 pb-3 pt-[70px]" : "px-14 pt-16"}`}
			>
				<div
					className={`font-bold uppercase tracking-[0.16em] text-white/75 ${P ? "text-[20px]" : "text-[24px]"}`}
				>
					What is GoodWatch?
				</div>
				<div
					className={`font-bold leading-[1.02] tracking-tight ${P ? "mt-1" : "mt-2"}`}
					style={{ fontSize: P ? 32 : 60 }}
				>
					One score, how it feels, where it streams.
				</div>
				<div
					className={`text-white/80 ${P ? "mt-2 text-[20px] leading-tight" : "mt-3 text-[30px]"}`}
				>
					IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account
					needed.
				</div>
				<div
					className={`grid grid-cols-2 ${P ? "mt-4 gap-2.5" : "mt-10 gap-5"}`}
				>
					{ANSWERS.filter((answer) => items.includes(answer.id)).map((a) => (
						<Item
							key={a.id}
							id={a.id}
							className={`tvc-btn flex items-center justify-center px-4 text-center leading-tight ${P ? "h-[52px] text-[22px]" : "h-[116px] rounded-[26px] text-[32px]"}`}
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
