// The layout of the sign-in, sign-up, and password pages: the poster wall with its spotlight, a large headline on
// wide screens, and the form in a card under the GoodWatch wordmark. The card's border carries a slowly turning
// aurora of color. It turns a gradient layer underneath the card with a transform, so it costs no repaints.
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { type AuthPoster, PosterSpotlight } from "~/ui/auth/PosterSpotlight"

const HEADLINE = "Somewhere in here is your next favorite."

// The fields and the main button of the forms inside the card. A field the server turned away gets a red border.
const AUTH_INPUT_BASE =
	"w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-white placeholder-white/30 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400/70"
export const authInputClass = (error?: boolean) => `${AUTH_INPUT_BASE} ${error ? "border-red-500" : "border-white/10"}`
export const AUTH_INPUT_CLASS = authInputClass()
export { AUTH_SUBMIT_CLASS } from "./PrimaryButton"

const SCENE_CSS = `
@keyframes auth-card-in { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
@keyframes auth-word-in { from { opacity: 0; filter: blur(12px); transform: translateY(14px) } to { opacity: 1; filter: none; transform: none } }
.auth-card { animation: auth-card-in .8s cubic-bezier(.22,1,.36,1) .15s both }
.auth-word { animation: auth-word-in .7s cubic-bezier(.22,1,.36,1) both }
@keyframes auth-aurora { from { transform: translate(-50%, -50%) rotate(0deg) } to { transform: translate(-50%, -50%) rotate(360deg) } }
@media (prefers-reduced-motion: reduce) { .auth-aurora, .auth-card, .auth-word { animation: none !important } }
`

/** Words fade in from a blur, one after another. */
function Headline() {
	return (
		<p className="hidden max-w-xl text-6xl font-black leading-[1.02] tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,.9)] lg:block xl:text-7xl">
			{HEADLINE.split(" ").map((word, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: the words never change
					key={i}
					className="auth-word inline-block"
					style={{ animationDelay: `${i * 0.08}s` }}
				>
					{word}&nbsp;
				</span>
			))}
		</p>
	)
}

/** The card's border is a 1.5 px gap that shows a turning color wheel behind the card's solid face. The wheel is a
 * square twice the card's width, so it covers the corners of tall and short cards at every angle. */
function AuroraCard({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="auth-card relative isolate w-full max-w-md shrink-0 overflow-hidden rounded-3xl p-[1.5px]"
		>
			<div
				className="auth-aurora pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[200%] opacity-80 will-change-transform"
				style={{
					animation: "auth-aurora 14s linear infinite",
					background: "conic-gradient(from 0deg, #f59e0b, #db2777, #7c3aed, #0d9488, #f59e0b)",
				}}
			/>
			<div className="relative rounded-[calc(1.5rem-1.5px)] bg-gray-950 px-7 py-8 shadow-2xl shadow-black/60 sm:px-9">
				<div className="mb-7 flex justify-center">
					<GoodWatchWordmark fontSize={40} />
				</div>
				{children}
			</div>
		</div>
	)
}

export function AuthScene({ posters, children, aside }: { posters: AuthPoster[]; children: React.ReactNode; aside?: React.ReactNode }) {
	return (
		<div className="relative min-h-[max(calc(100svh-4rem),680px)] w-full overflow-hidden bg-gray-950">
			<style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
			{/* On phones the wall doesn't show: a soft amber light stands in for it. */}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(245,158,11,.14),transparent)] lg:hidden" />
			<PosterSpotlight posters={posters} />
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/40 to-transparent" />
			<div className="pointer-events-none relative mx-auto flex min-h-[max(calc(100svh-4rem),680px)] max-w-7xl items-center justify-center gap-10 px-4 py-10 sm:px-8 lg:justify-between">
				{aside ? <div className="hidden lg:block">{aside}</div> : <Headline />}
				<div className="pointer-events-auto flex w-full max-w-md justify-center">
					<AuroraCard>{children}</AuroraCard>
				</div>
			</div>
		</div>
	)
}
