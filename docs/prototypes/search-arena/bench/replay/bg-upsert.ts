// Background writer standing in for the Windmill vector_data flow: every N seconds, upsert a burst of ~260 points
// (read back with all vectors and payload, then written unchanged, so the catalog stays identical while Qdrant does
// the real write work: WAL, new point versions, segment optimization). One JSON line per burst on stdout.
// node bg-upsert.ts <collection> <every seconds>
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QdrantClient } from "@qdrant/js-client-rest";

const HERE = dirname(fileURLToPath(import.meta.url));
const [collection, every] = [process.argv[2], Number(process.argv[3] ?? 60)];
const ids: number[] = JSON.parse(readFileSync(join(HERE, "..", "..", "data", "emb-ids.json"), "utf8"));
const client = new QdrantClient({ url: "http://127.0.0.1:16333", checkCompatibility: false, timeout: 60000 });
let s = 99;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const BURST = 260;

async function burst() {
	const pick = Array.from({ length: BURST }, () => ids[Math.floor(rnd() * ids.length)]);
	const t0 = performance.now();
	const pts = await client.retrieve(collection, { ids: [...new Set(pick)], with_payload: true, with_vector: true });
	const t1 = performance.now();
	await client.upsert(collection, { wait: true, points: pts.map((p) => ({ id: p.id, vector: p.vector as any, payload: p.payload ?? {} })) });
	const t2 = performance.now();
	process.stdout.write(JSON.stringify({ at: new Date().toISOString(), points: pts.length, read_ms: t1 - t0, upsert_ms: t2 - t1 }) + "\n");
}

await new Promise((r) => setTimeout(r, 5000));
for (;;) {
	await burst();
	await new Promise((r) => setTimeout(r, every * 1000));
}
