// Query encoder worker thread: both fp32 onnxruntime-node sessions (bge-base-en-v1.5, multilingual-e5-small) at
// 4 intra-op threads, loaded once. One request = one query's texts, one batch per model. Requests run one at a time
// (a single ORT session per model; concurrent runs would only split the same cores), so a request waits in `queue`
// while earlier ones encode. Timestamps are absolute (timeOrigin + now) so the main thread can line them up.
import { parentPort, workerData } from "node:worker_threads";
import { loadEncoder } from "../encoders/lib.mjs";

const threads = workerData?.threads ?? 4;
const enc = { bge: await loadEncoder("bge", "fp32", threads), me5s: await loadEncoder("me5s", "fp32", threads) };
// warm both sessions (first runs allocate)
for (let i = 0; i < 5; i++) {
  await enc.bge.encodeQueries(["warm up the encoder", "dark comedy"]);
  await enc.me5s.encodeQueries(["warm up the encoder", "comedia negra"]);
}
const now = () => performance.timeOrigin + performance.now();
const queue = [];
let busy = false;

async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const { msg, received } = queue.shift();
    const started = now();
    const out = {};
    const perModel = {};
    for (const g of msg.groups) {
      const t = now();
      out[g.model] = await enc[g.model].encodeQueries(g.texts);
      perModel[g.model] = now() - t;
    }
    const done = now();
    const buffers = [];
    const vectors = {};
    for (const [m, vs] of Object.entries(out)) {
      vectors[m] = vs;
      for (const v of vs) buffers.push(v.buffer);
    }
    parentPort.postMessage({ id: msg.id, vectors, received, started, done, perModel }, buffers);
  }
  busy = false;
}

parentPort.on("message", (msg) => {
  queue.push({ msg, received: now() });
  drain();
});
parentPort.postMessage({ ready: true });
