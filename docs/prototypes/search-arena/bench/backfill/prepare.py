"""Prepare the CPU backfill benchmark: sample texts, token-length stats, ONNX fp32 export, int8 dynamic quantization.

Writes bench/backfill/cache/sample-<model>.json, bench/backfill/cache/lengths.json and
bench/backfill/models/<model>/model-{fp32,int8}.onnx (gitignored, regenerable).

Usage: CUDA_VISIBLE_DEVICES= .venv/bin/python bench/backfill/prepare.py
"""
import json, os
import numpy as np

os.environ["CUDA_VISIBLE_DEVICES"] = ""
import common as C  # noqa: E402

CHUNK_SIZES = [32, 256, 1000, 2000, 5000, 191634]
BATCH = 32


def padded_tokens(lens, chunk):
    """Tokens computed when the catalog is cut into chunks (catalog order), each sorted by length, batched by 32."""
    total = 0
    for s in range(0, len(lens), chunk):
        c = np.sort(lens[s:s + chunk])
        for b in range(0, len(c), BATCH):
            total += int(c[b:b + BATCH].max()) * len(c[b:b + BATCH])
    return total


def export(model):
    import torch
    from transformers import AutoModel
    from onnxruntime.quantization import quantize_dynamic, QuantType
    cfg = C.MODELS[model]
    os.makedirs(os.path.dirname(C.onnx_path(model, "fp32")), exist_ok=True)
    fp32 = C.onnx_path(model, "fp32")
    if not os.path.exists(fp32):
        base = AutoModel.from_pretrained(cfg["hf"], attn_implementation="eager").eval()

        class Encoder(torch.nn.Module):  # keyword call: transformers 5 forward() takes more positionals
            def __init__(self, m):
                super().__init__()
                self.m = m

            def forward(self, input_ids, attention_mask, token_type_ids):
                return self.m(input_ids=input_ids, attention_mask=attention_mask,
                              token_type_ids=token_type_ids).last_hidden_state

        m = Encoder(base)
        ids = torch.ones(2, 16, dtype=torch.long)
        args = (ids, torch.ones_like(ids), torch.zeros_like(ids))
        axes = {0: "batch", 1: "seq"}
        torch.onnx.export(m, args, fp32, input_names=["input_ids", "attention_mask", "token_type_ids"],
                          output_names=["last_hidden_state"], opset_version=17, dynamo=False,
                          dynamic_axes={"input_ids": axes, "attention_mask": axes, "token_type_ids": axes,
                                        "last_hidden_state": axes})
    int8 = C.onnx_path(model, "int8")
    if not os.path.exists(int8):
        # Dynamic quantization: int8 weights, uint8 activations quantized per batch at run time.
        quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8, per_channel=True)
    return {p: os.path.getsize(C.onnx_path(model, p)) for p in ("fp32", "int8")}


def main():
    from transformers import AutoTokenizer
    os.makedirs(os.path.join(C.HERE, "cache"), exist_ok=True)
    rows, idx = C.sample_rows()
    stats = {}
    for model, cfg in C.MODELS.items():
        tok = AutoTokenizer.from_pretrained(cfg["hf"])
        all_texts = C.texts_for(model, rows)
        lens = np.array([len(x) for x in tok(all_texts, truncation=True, max_length=C.MAX_LEN)["input_ids"]])
        raw = np.array([len(x) for x in tok(all_texts, truncation=False)["input_ids"]])
        sample = [all_texts[i] for i in idx]
        json.dump({"idx": idx.tolist(), "texts": sample}, open(C.sample_path(model), "w"))
        ideal = int(lens.sum())
        pct = lambda a: {f"p{p}": int(np.percentile(a, p)) for p in (5, 25, 50, 75, 95, 99)}
        stats[model] = {
            "catalog_tokens": {"mean": round(float(lens.mean()), 1), **pct(lens), "max": int(lens.max()),
                               "truncated_share": round(float((raw > C.MAX_LEN).mean()), 4)},
            "sample_tokens": {"mean": round(float(lens[idx].mean()), 1), **pct(lens[idx])},
            "chars_mean": round(float(np.mean([len(t) for t in all_texts])), 1),
            "padding_overhead_by_chunk": {str(c): round(padded_tokens(lens, c) / ideal - 1, 4) for c in CHUNK_SIZES},
            "onnx_bytes": export(model),
        }
        print(model, json.dumps(stats[model]), flush=True)
    json.dump(stats, open(os.path.join(C.HERE, "cache", "lengths.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
