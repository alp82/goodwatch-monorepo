// PROTOTYPE - throwaway (issue #534). The account pages rebuilt for Better Auth, and the pages an app such as Claude
// needs: sign-in, sign-up, email verification, password reset, the one-time "please sign in again" notice, the OAuth
// consent page and Connected apps in the settings.
//   /prototype/auth?screen=<screen>&state=<state>&variant=A|B&client=claude|chatgpt|claude-code|unknown&shot=1
// Everything is made up: no sign-in service is called, nothing is saved. `shot=1` hides the prototype bar.
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { Done, Emails, Forgot, Reset, SignIn, SignUp, Verify } from "~/ui/prototype-auth/account"
import { ConnectedApps } from "~/ui/prototype-auth/connected"
import { Consent } from "~/ui/prototype-auth/consent"
import { CutoverBanner, CutoverDialog } from "~/ui/prototype-auth/cutover"
import { CLIENTS, type ClientKey } from "~/ui/prototype-auth/kit"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Account pages prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

type Screen = { label: string; states: string[]; variants?: Record<string, string> }
const SCREENS: Record<string, Screen> = {
	"sign-in": { label: "Sign in", states: ["form", "error", "unverified", "throttled", "connect", "cutover"] },
	"sign-up": { label: "Sign up", states: ["form", "guest", "taken", "connect"] },
	verify: { label: "Email verification", states: ["sent", "confirmed", "expired"] },
	forgot: { label: "Password reset: request", states: ["form", "sent"] },
	reset: { label: "Password reset: new password", states: ["form", "done", "expired"] },
	emails: { label: "The two emails", states: ["both"] },
	notice: { label: "Sign in again (cut-over)", states: ["shown"], variants: { A: "Banner, then the sign-in page", B: "Dialog with the sign-in inside" } },
	consent: { label: "Consent (connect an app)", states: ["ask", "allowed", "denied"], variants: { A: "Card inside the site, fixed access", B: "Own page, See only or See and change" } },
	apps: { label: "Connected apps", states: ["list", "confirm", "empty"], variants: { A: "Own tab in Settings", B: "Section in Account" } },
	done: { label: "(after sign-in)", states: ["-"] },
}

export default function AuthPrototype() {
	const [params] = useSearchParams()
	const screenKey = params.get("screen") ?? "sign-in"
	const screen = SCREENS[screenKey] ? screenKey : "sign-in"
	const state = params.get("state") ?? SCREENS[screen].states[0]
	const variant = (params.get("variant") === "B" ? "B" : "A") as "A" | "B"
	const clientParam = params.get("client") as ClientKey | null
	const client: ClientKey = clientParam && clientParam in CLIENTS ? clientParam : "claude"
	const shot = params.get("shot") === "1"

	return (
		<div className="text-gray-300">
			{/* The query devtools' button sits over a phone's primary buttons. */}
			<style>{".tsqd-open-btn-container{display:none!important}"}</style>
			{screen === "sign-in" && <SignIn key={state} state={state} client={client} />}
			{screen === "sign-up" && <SignUp key={state} state={state} client={client} />}
			{screen === "verify" && <Verify key={state} state={state} />}
			{screen === "forgot" && <Forgot state={state} />}
			{screen === "reset" && <Reset key={state} state={state} />}
			{screen === "emails" && <Emails />}
			{screen === "notice" && (variant === "A" ? <CutoverBanner key={state} state={state} /> : <CutoverDialog key={state} />)}
			{screen === "consent" && <Consent key={`${variant}${state}${client}`} variant={variant} state={state} client={client} />}
			{screen === "apps" && <ConnectedApps key={`${variant}${state}`} variant={variant} state={state} />}
			{screen === "done" && <Done />}
			{!shot && <PrototypeBar screen={screen} state={state} variant={variant} client={client} />}
		</div>
	)
}

function PrototypeBar({ screen, state, variant, client }: { screen: string; state: string; variant: "A" | "B"; client: ClientKey }) {
	const [params, setParams] = useSearchParams()
	const set = (next: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		for (const [key, value] of Object.entries(next)) value === null ? p.delete(key) : p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const info = SCREENS[screen]
	const variants = info.variants
	const flip = () => set({ variant: variant === "A" ? "B" : "A" })
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (variants && (e.key === "ArrowLeft" || e.key === "ArrowRight")) flip()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	const showClient = screen === "consent" || state === "connect"
	const select = "rounded-full border-0 bg-neutral-100 py-1 pl-3 pr-8 text-sm font-semibold text-black focus:ring-2 focus:ring-fuchsia-500"
	return (
		<div className="fixed bottom-24 left-1/2 z-[1200] flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-white px-2 py-1.5 text-sm font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 md:bottom-6">
			<select aria-label="Screen" className={select} value={screen} onChange={(e) => set({ screen: e.target.value, state: null })}>
				{Object.entries(SCREENS)
					.filter(([key]) => key !== "done")
					.map(([key, s]) => (
						<option key={key} value={key}>
							{s.label}
						</option>
					))}
			</select>
			{info.states.length > 1 && (
				<select aria-label="State" className={select} value={state} onChange={(e) => set({ state: e.target.value })}>
					{info.states.map((s) => (
						<option key={s}>{s}</option>
					))}
				</select>
			)}
			{showClient && (
				<select aria-label="App" className={select} value={client} onChange={(e) => set({ client: e.target.value })}>
					{Object.entries(CLIENTS).map(([key, c]) => (
						<option key={key} value={key}>
							{c.name}
							{c.verified ? "" : " (unverified)"}
						</option>
					))}
				</select>
			)}
			{variants && (
				<button type="button" onClick={flip} className="rounded-full px-3 py-1 hover:bg-neutral-200" title="Switch variant (← →)">
					← {variant}: {variants[variant]} →
				</button>
			)}
		</div>
	)
}
