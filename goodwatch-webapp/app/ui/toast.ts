// Notifications are interaction-only. Neither the container, its library nor its stylesheet belongs to a page's
// first view. Keep messages and rich actions through a failed load, retrying on the next notification or reconnect.
import type { ToastContent, ToastOptions } from "react-toastify"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { createToastQueue } from "./toast-queue"

const load = reloadOnStaleChunk(() => import("./toast-runtime"))
const offline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false
const notifications = createToastQueue(
	() => {
		// An offline import is not evidence of a stale build. Keep the queue without triggering a page reload.
		if (offline())
			return Promise.reject(
				new Error("Notifications are waiting for a connection"),
			)
		return load()
	},
	(error) => {
		if (!offline()) console.error("Could not load notification", error)
	},
)
let listening = false

type Kind = "default" | "info" | "success" | "error"

function show<T>(
	kind: Kind,
	content: ToastContent<T>,
	options?: ToastOptions<T>,
) {
	if (!listening && typeof window !== "undefined") {
		listening = true
		window.addEventListener("online", () => void notifications.retry())
	}
	notifications.enqueue((module) => module.showToast(kind, content, options))
}

function notify<T = unknown>(
	content: ToastContent<T>,
	options?: ToastOptions<T>,
) {
	show("default", content, options)
}

export const toast = Object.assign(notify, {
	info: <T = unknown>(content: ToastContent<T>, options?: ToastOptions<T>) =>
		show("info", content, options),
	success: <T = unknown>(content: ToastContent<T>, options?: ToastOptions<T>) =>
		show("success", content, options),
	error: <T = unknown>(content: ToastContent<T>, options?: ToastOptions<T>) =>
		show("error", content, options),
})
