// PROTOTYPE - throwaway (#220 round 4). A faithful mock of the Taste page behind REC_TASTE_PAGE on origin/main
// (TasteTabs, TasteTabFrame's Sample taste band, SignUpPrompt), with the rating banner that leads to the quiz page.
// Banner states: guest with 0, guest mid-quiz (3 of 5), guest at 5+, guest who just saved, new member, member.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { BY, poster } from "~/ui/prototype-taste-quiz-fit-3/data"
import { GoogleG } from "./google"
import { Dots, GOAL, QUIZ_PATH, firstPosters } from "./page"

export type TasteState = "zero" | "mid" | "five" | "joined"
export type Who = "guest" | "new" | "me"

const TABS = ["Sides of you", "You vs everyone", "Fingerprint"]

/** TasteTabs' look; the tabs switch in place here. */
function Tabs({ at, set }: { at: number; set: (i: number) => void }) {
	return (
		<nav
			aria-label="Your taste"
			className="border-b border-white/10 bg-gray-950"
		>
			<div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:gap-8 md:px-8">
				{TABS.map((name, i) => (
					<button
						key={name}
						type="button"
						onClick={() => set(i)}
						className={`-mb-px flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition md:py-4 md:text-base ${i === at ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}
					>
						{name}
					</button>
				))}
			</div>
		</nav>
	)
}

const rateBtn =
	"inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 hover:brightness-110 md:min-h-9"

function quizHref(who: Who, from = 0) {
	return `${QUIZ_PATH}?as=${who}${from ? `&from=${from}` : ""}`
}

/** The banner: the Sample taste band grown into the way into the quiz. */
function Banner({ who, state }: { who: Who; state: TasteState }) {
	const [toast, setToast] = useState<string | null>(null)
	const fan = (
		<span className="hidden shrink-0 -space-x-5 sm:flex" aria-hidden>
			{firstPosters.map((t, i) => (
				<img
					key={t.key}
					src={poster(t, "w92")}
					alt=""
					className="aspect-[2/3] w-11 rounded-md border-2 border-gray-950 object-cover shadow-lg"
					style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}
				/>
			))}
		</span>
	)
	if (who !== "guest")
		return (
			<section
				aria-label="Rate more"
				className="border-b border-white/10 bg-gray-900/60"
			>
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-8">
					<p className="text-sm text-gray-300">
						{who === "new"
							? "Your taste is from 5 ratings. A few more and the sides get sharper."
							: "From your 42 ratings."}
					</p>
					<Link
						to={quizHref(who)}
						className={
							who === "new"
								? rateBtn
								: "inline-flex min-h-11 items-center text-sm font-bold text-amber-300 hover:text-amber-200 md:min-h-9"
						}
					>
						Rate more →
					</Link>
				</div>
			</section>
		)
	if (state === "five" || state === "joined")
		return (
			<section
				aria-label="Your taste"
				className="border-b border-emerald-500/20 bg-emerald-950/25"
			>
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
					<span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
						Your taste
					</span>
					<p className="text-sm text-emerald-50/90">
						{state === "joined"
							? "Saved to your account. Rate more to sharpen it."
							: "From your 5 ratings on this device. Save it so it follows you."}
					</p>
					<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
						{state === "five" && (
							<button
								type="button"
								onClick={() =>
									setToast(
										"Prototype: Continue with Google, and the 5 ratings move to the account.",
									)
								}
								className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-gray-100 px-4 text-sm font-bold text-gray-900 ring-2 ring-inset ring-gray-400 hover:bg-white md:min-h-9"
							>
								<GoogleG size={16} /> Save my taste · free
							</button>
						)}
						<Link
							to={quizHref("guest", 5)}
							className="inline-flex min-h-11 items-center text-sm font-bold text-amber-300 hover:text-amber-200 md:min-h-9"
						>
							Rate more →
						</Link>
					</span>
				</div>
				{toast && (
					<div
						role="status"
						className="mx-auto max-w-7xl px-4 pb-3 text-sm text-gray-300 md:px-8"
					>
						{toast}
					</div>
				)}
			</section>
		)
	const mid = state === "mid"
	return (
		<section
			aria-label="Sample taste"
			className="border-b border-amber-500/20 bg-amber-950/30"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 md:px-8">
				{fan}
				<div className="min-w-0 flex-1 basis-64">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
							Sample taste
						</span>
						{mid && <Dots at={3} of={GOAL} />}
					</div>
					<p className="mt-1.5 text-sm text-amber-50/90 md:text-base">
						{mid
							? "3 of 5 rated. 2 more and this becomes your taste."
							: `This is someone else's taste. Rate ${GOAL} titles you've seen to see your own: one at a time, about a minute.`}
					</p>
				</div>
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<Link to={quizHref("guest", mid ? 3 : 0)} className={rateBtn}>
						{mid ? "Keep rating" : "Rate titles"} →
					</Link>
					<Link
						to="/sign-in"
						onClick={(e) => e.preventDefault()}
						className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-200/80 hover:text-amber-100 md:min-h-9"
					>
						Have an account? Sign in
					</Link>
				</span>
			</div>
		</section>
	)
}

/** A stand-in for the Sides of you tab: enough to show where the banner sits. */
function SidesMock({ sample }: { sample: boolean }) {
	const sides = [
		{
			name: "Dark, tense crime",
			keys: ["movie:155", "movie:807", "show:1396"],
		},
		{
			name: "Big mind-benders",
			keys: ["movie:27205", "movie:157336", "movie:603"],
		},
		{ name: "Warm and funny", keys: ["movie:13", "show:2316", "movie:129"] },
	]
	return (
		<div className="mx-auto max-w-7xl px-4 pt-8 md:px-8 md:pt-12">
			<h1 className="text-3xl font-extrabold text-white md:text-5xl">
				{sample ? "Their sides" : "Sides of you"}
			</h1>
			<p className="mt-2 max-w-2xl text-gray-400">
				The kinds of titles you keep loving, and what's just past each of them.
			</p>
			<div className="mt-8 grid gap-4 md:grid-cols-3">
				{sides.map((s) => (
					<div
						key={s.name}
						className={`rounded-2xl border-2 border-gray-800 bg-gray-900 p-4 ${sample ? "opacity-70" : ""}`}
					>
						<div className="font-bold text-gray-100">{s.name}</div>
						<div className="mt-3 grid grid-cols-3 gap-2">
							{s.keys.map((k) => (
								<img
									key={k}
									src={poster(BY[k], "w185")}
									alt={BY[k].title}
									className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export function TastePage({ who, state }: { who: Who; state: TasteState }) {
	const [tab, setTab] = useState(0)
	const sample = who === "guest" && (state === "zero" || state === "mid")
	return (
		<div className="pb-32 text-white">
			<Tabs at={tab} set={setTab} />
			<Banner who={who} state={state} />
			<SidesMock sample={sample} />
		</div>
	)
}
