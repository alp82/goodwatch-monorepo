// Query encoders as the webapp port would run them: onnxruntime-node sessions over the Xenova ONNX exports, the
// transformers.js tokenizer, the harness's text preparation (harness/catalog.py EMBEDDINGS, scripts/embed_catalog.py).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";
import { AutoTokenizer, env } from "@huggingface/transformers";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ARENA = join(HERE, "..", "..");
env.cacheDir = join(HERE, "models");

export const MODELS = {
  // bge: CLS pooling, query instruction (harness/catalog.py "bgeb-notitle"), passages without prefix
  bge: {
    repo: "Xenova/bge-base-en-v1.5", hf: "BAAI/bge-base-en-v1.5", dim: 768, pooling: "cls",
    queryPrefix: "Represent this sentence for searching relevant passages: ", passagePrefix: "",
  },
  // multilingual-e5-small: mean pooling over the attention mask, "query: " / "passage: " prefixes
  me5s: {
    repo: "Xenova/multilingual-e5-small", hf: "intfloat/multilingual-e5-small", dim: 384, pooling: "mean",
    queryPrefix: "query: ", passagePrefix: "passage: ",
  },
};
export const PRECISIONS = { fp32: "model.onnx", int8: "model_quantized.onnx" };
const MAX_LEN = 512; // SentenceTransformer max_seq_length for both models

/** Local path of an ONNX file: the Hugging Face hub cache if present, else downloaded into ./models. */
export async function modelFile(repo, file) {
  const snaps = join(homedir(), ".cache/huggingface/hub", `models--${repo.replace("/", "--")}`, "snapshots");
  if (existsSync(snaps)) {
    for (const s of readdirSync(snaps)) {
      const p = join(snaps, s, "onnx", file);
      if (existsSync(p)) return p;
    }
  }
  const p = join(HERE, "models", repo, "onnx", file);
  if (!existsSync(p)) {
    const r = await fetch(`https://huggingface.co/${repo}/resolve/main/onnx/${file}`);
    if (!r.ok) throw new Error(`download ${repo}/${file}: ${r.status}`);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, Buffer.from(await r.arrayBuffer()));
  }
  return p;
}

export async function loadEncoder(key, precision, threads) {
  const cfg = MODELS[key];
  const t0 = performance.now();
  const tokenizer = await AutoTokenizer.from_pretrained(cfg.repo);
  const load = { tokenizer_ms: performance.now() - t0, rss_after_tokenizer: process.memoryUsage().rss };
  const t1 = performance.now();
  const session = await ort.InferenceSession.create(await modelFile(cfg.repo, PRECISIONS[precision]), {
    intraOpNumThreads: threads,
    interOpNumThreads: 1,
    executionMode: "sequential",
    graphOptimizationLevel: "all",
  });
  load.session_ms = performance.now() - t1;
  const inputs = session.inputNames;

  /** L2-normalized vectors (Float32Array each) for the texts, already prefixed. */
  async function encodeRaw(texts) {
    const enc = tokenizer(texts, { padding: true, truncation: true, max_length: MAX_LEN });
    const [B, T] = enc.input_ids.dims;
    const feeds = {};
    for (const name of inputs) {
      const src = name === "token_type_ids" && !enc.token_type_ids ? null : enc[name];
      const data = src ? src.data : new BigInt64Array(B * T);
      feeds[name] = new ort.Tensor("int64", data, [B, T]);
    }
    const out = await session.run(feeds);
    const h = out.last_hidden_state ?? out[session.outputNames[0]];
    const D = h.dims[2], hd = h.data, mask = enc.attention_mask.data;
    const vecs = [];
    for (let b = 0; b < B; b++) {
      const v = new Float32Array(D);
      if (cfg.pooling === "cls") {
        v.set(hd.subarray(b * T * D, b * T * D + D));
      } else {
        let n = 0;
        for (let t = 0; t < T; t++) {
          if (!mask[b * T + t]) continue;
          n++;
          const o = (b * T + t) * D;
          for (let d = 0; d < D; d++) v[d] += hd[o + d];
        }
        for (let d = 0; d < D; d++) v[d] /= n;
      }
      let s = 0;
      for (let d = 0; d < D; d++) s += v[d] * v[d];
      s = Math.sqrt(s) || 1;
      for (let d = 0; d < D; d++) v[d] /= s;
      vecs.push(v);
    }
    return vecs;
  }
  return {
    cfg, session, tokenizer, encodeRaw, load,
    encodeQueries: (texts) => encodeRaw(texts.map((t) => cfg.queryPrefix + t)),
    encodePassages: (texts) => encodeRaw(texts.map((t) => cfg.passagePrefix + t)),
  };
}

/** Short facet-like phrases the harness actually encoded (query caches), deterministic order, for batch timing. */
export function phrasePool() {
  const keys = new Set();
  for (const f of ["query-emb-bge-base-en-v1.5.json", "query-emb-multilingual-e5-small.json"]) {
    for (const k of Object.keys(JSON.parse(readFileSync(join(ARENA, "data", f), "utf8")))) keys.add(k);
  }
  const short = [...keys].filter((k) => k.length >= 3 && k.length <= 60);
  // deterministic shuffle (LCG) so batches mix single words, phrases and short queries
  let s = 12345;
  for (let i = short.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [short[i], short[j]] = [short[j], short[i]];
  }
  return short;
}

export const pct = (v, p) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))];
};
export const r2 = (x) => Math.round(x * 100) / 100;
