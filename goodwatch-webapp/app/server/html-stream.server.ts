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

	constructor() {
		super({ writableHighWaterMark: WRITE_BUFFER_BYTES })
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
		this.push(parts.length === 1 ? parts[0] : Buffer.concat(parts))
	}

	_flush(callback: TransformCallback): void {
		this.flush()
		callback()
	}
}
