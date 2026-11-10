import { createRoot, type Root } from "react-dom/client"
import { ToastContainer, toast, type ToastContent, type ToastOptions } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

let container: HTMLDivElement | undefined
let root: Root | undefined

export function showToast<T>(
	kind: "default" | "info" | "success" | "error",
	content: ToastContent<T>,
	options?: ToastOptions<T>,
) {
	// A document recovery can replace the body. Recreate only the container it removed.
	if (!container?.isConnected) {
		root?.unmount()
		container = document.createElement("div")
		container.dataset.toastHost = ""
		document.body.append(container)
		root = createRoot(container)
		root.render(<ToastContainer />)
	}
	// React Toastify queues this until the container's effects register it, including the very first message.
	if (kind === "default") toast(content, options)
	else toast[kind](content, options)
}
