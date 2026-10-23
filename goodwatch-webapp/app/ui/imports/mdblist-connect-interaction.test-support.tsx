// The MDBList key form in happy-dom: a member pastes a key, the form is submitted, and the field must be empty
// afterwards, whether MDBList accepted the key or not.
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/settings/imports" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Node"])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MdblistConnectControls } = await import("./MdblistConnectPanel")

const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container as unknown as Element)
const field = () =>
	container.querySelector('input[name="apiKey"]') as unknown as HTMLInputElement
const render = (props: {
	pending: boolean
	error?: string
	submissions: number
}) => act(async () => root.render(h(MdblistConnectControls, props)))

const values: Record<string, string> = {}
await render({ pending: false, submissions: 0 })
field().value = "synthetic-key-0001"
values.typed = field().value
// The panel counts a submission once the form data is taken; a refused key comes back as an error.
await render({ pending: true, submissions: 1 })
values.whileReading = field().value
await render({
	pending: false,
	error: "MDBList didn't accept this API key.",
	submissions: 1,
})
values.afterRefusal = field().value
field().value = "synthetic-key-0002"
await render({ pending: true, submissions: 2 })
await render({ pending: false, submissions: 2 })
values.afterSecond = field().value
// Rerenders without a new submission keep what the member is typing.
field().value = "synthetic-key-0003"
await render({
	pending: false,
	error: "Still the same message.",
	submissions: 2,
})
values.typingKept = field().value
await act(async () => root.unmount())
process.stdout.write(`__MDBLIST_FORM__${JSON.stringify(values)}`)
process.exit(0)
