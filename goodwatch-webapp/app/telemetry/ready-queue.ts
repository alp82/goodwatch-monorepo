/**
 * Holds calls for a tool that loads later. Calls made before the tool is ready run in order when it gets ready; calls
 * made after run at once. A call that throws is reported and doesn't stop the others.
 */
export interface ReadyQueue<Tool> {
	run: (call: (tool: Tool) => void) => void
	ready: (tool: Tool) => void
}

export function createReadyQueue<Tool>(
	onError: (error: unknown) => void,
): ReadyQueue<Tool> {
	let tool: Tool | undefined
	let isReady = false
	const waiting: Array<(tool: Tool) => void> = []
	const execute = (call: (tool: Tool) => void) => {
		try {
			call(tool as Tool)
		} catch (error) {
			onError(error)
		}
	}
	return {
		run(call) {
			if (isReady) execute(call)
			else waiting.push(call)
		},
		ready(readyTool) {
			if (isReady) return
			tool = readyTool
			isReady = true
			for (const call of waiting.splice(0, waiting.length)) execute(call)
		},
	}
}
