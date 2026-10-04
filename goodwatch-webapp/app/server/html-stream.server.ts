// The stream between React's server renderer and the HTTP response.
//
// React writes a page in chunks of about 2 KB (162 for a movie page). Remix sends each chunk through a web stream, the
// compression middleware and the socket separately, and flushes the compressor after every one. That cost a movie page
// 35 ms of main-thread time and about 160 event loop turns after the first byte, each of which waits behind every
// other render in the process (see docs/benchmarks/viral-spike-render-profile.md).
//
// This stream collects what React writes in one pass and hands it on as one chunk. React calls flush() at the end of
// every pass, so a page without Suspense boundaries leaves as a single chunk, and a page with boundaries still streams
// one chunk per pass.
import { Transform, type TransformCallback } from "node:stream"

// React never has to wait for this stream: a chunk is taken as soon as it is written.
const WRITE_BUFFER_BYTES = 16 * 1024 * 1024

export class HtmlStream extends Transform {
	#parts: Uint8Array[] = []
	#complete: Uint8Array[] = []
	#onComplete?: (html: Buffer) => void

	constructor(onComplete?: (html: Buffer) => void) {
		super({ writableHighWaterMark: WRITE_BUFFER_BYTES })
		this.#onComplete = onComplete
	}

	_transform(
		chunk: Uint8Array,
		_encoding: BufferEncoding,
		callback: TransformCallback,
	): void {
		this.#parts.push(chunk)
		callback()
	}

	/** Hands everything collected so far to the response. React calls this after each pass of finished work. */
	flush(): void {
		if (this.#parts.length === 0 || this.destroyed) return
		const parts = this.#parts
		this.#parts = []
		const chunk = parts.length === 1 ? parts[0] : Buffer.concat(parts)
		if (this.#onComplete) this.#complete.push(chunk)
		this.push(chunk)
	}

	_flush(callback: TransformCallback): void {
		this.flush()
		if (!this.destroyed && this.#onComplete) {
			const complete = this.#onComplete
			this.#onComplete = undefined
			complete(
				this.#complete.length === 1 && Buffer.isBuffer(this.#complete[0])
					? this.#complete[0]
					: Buffer.concat(this.#complete),
			)
			this.#complete = []
		}
		callback()
	}

	_destroy(error: Error | null, callback: (error: Error | null) => void): void {
		this.#parts = []
		this.#complete = []
		this.#onComplete = undefined
		callback(error)
	}
}
