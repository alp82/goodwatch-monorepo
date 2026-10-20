import assert from "node:assert/strict"
import { Window } from "happy-dom"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"sessionStorage",
])
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value: name === "window" ? browser : browser[name as keyof Window],
	})
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	addEventListener: browser.addEventListener.bind(browser),
	removeEventListener: browser.removeEventListener.bind(browser),
})
const { createElement: h, act, Children } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MemoryRouter } = await import("react-router-dom")
const { AuthContext } = await import("~/utils/auth")
const { useHomeIntro } = await import("./HomeIntro")
const { PROGRESS_KEY, TAPS_KEY } = await import("./progress")
const { FILM_CHAPTER_EVENT } = await import("./events")
const { TasteQuiz } = await import("./quiz/taste-quiz")
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
let filmVisible = false
function Probe({ member }: { member: boolean }) {
	const intro = useHomeIntro({ member })
	// Inspect the hook's overlay without mounting its network-backed lazy film.
	filmVisible = Children.toArray(
		(intro.screen as React.ReactElement).props.children,
	).some(
		(child) =>
			typeof child === "object" &&
			"props" in child &&
			child.props.fallback === null,
	)
	return null
}
sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ scene: 4 }))
sessionStorage.setItem(
	TAPS_KEY,
	JSON.stringify({ keys: ["a", "b", "c"], pick: null }),
)
const draw = async (member: boolean) => {
	await act(async () =>
		root.render(h(MemoryRouter, null, h(Probe, { member }))),
	)
}
await draw(false)
assert.equal(filmVisible, true, "a guest resumes their quiz")
await draw(true)
assert.equal(
	filmVisible,
	false,
	"an auth transition must remove the guest signup quiz",
)
assert.deepEqual(JSON.parse(sessionStorage.getItem(PROGRESS_KEY)!), {
	left: true,
})
await act(async () => {
	browser.dispatchEvent(
		new browser.CustomEvent<string>(FILM_CHAPTER_EVENT, { detail: "closer" }),
	)
})
assert.equal(
	filmVisible,
	true,
	"a member can still explicitly replay the intro",
)
await draw(true)
assert.equal(
	filmVisible,
	true,
	"an unchanged auth state does not dismiss an explicit replay",
)

const cards = ["a", "b", "c"].map((key) => ({
	key,
	title: key,
	poster_path: "/poster.jpg",
	backdrop_path: "/backdrop.jpg",
	feels: [],
	services: [],
	goodwatch_overall_score_normalized_percent: 80,
}))
sessionStorage.setItem(
	TAPS_KEY,
	JSON.stringify({
		keys: cards.map((card) => card.key),
		pick: { top: cards[0], more: [], fallback: false },
	}),
)
let left = false
const auth = {
	user: { id: "member" },
	loading: false,
	betterAuth: true,
	maintenance: false,
	getSupabase: async () => {
		throw new Error("unused")
	},
	refreshUser() {},
}
await act(async () =>
	root.render(
		h(
			MemoryRouter,
			null,
			h(
				AuthContext.Provider,
				{ value: auth as never },
				h(TasteQuiz, {
					cards: cards as never,
					onLeave: () => {
						left = true
					},
				}),
			),
		),
	),
)
assert.equal(
	host.querySelector('a[href="/sign-up"]'),
	null,
	"member replay must not lead to signup",
)
const leave = [...host.querySelectorAll("button")].find(
	(button) => button.textContent === "Look around",
)
assert.ok(leave)
await act(async () => leave.click())
assert.equal(left, true)
await act(async () =>
	root.render(
		h(
			MemoryRouter,
			null,
			h(
				AuthContext.Provider,
				{ value: { ...auth, user: null } as never },
				h(TasteQuiz, { cards: cards as never, onLeave() {} }),
			),
		),
	),
)
assert.equal(
	host.querySelector('a[href="/sign-up"]')?.textContent?.trim(),
	"Keep my taste",
	"a guest still has their signup action and restored pick",
)
await act(async () => root.unmount())
await browser.happyDOM.close()
