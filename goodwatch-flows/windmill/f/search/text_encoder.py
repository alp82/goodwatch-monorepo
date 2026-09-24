"""Local text encoders for search: ONNX Runtime on the CPU, fp32, no torch.

The two models and their settings are part of the contract in ADR 0002:

- `bge-base-en-v1.5` (768 dimensions): CLS pooling.
- `multilingual-e5-small` (384 dimensions): mean pooling over the attention mask.
- Both: at most 512 tokens, L2-normalized. Int8 models failed parity, so both run in fp32.

The ONNX files and tokenizers come from the models' Hugging Face repositories at pinned
revisions, checked against pinned SHA-256 hashes. They are downloaded once per worker
host into Windmill's dependency cache volume, which survives worker restarts.
"""

import fcntl
import gc
import hashlib
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

MAX_TOKENS = 512
BATCH_SIZE = 32
THREADS = 4
# /tmp/windmill/cache is the worker's persistent volume (windmill_worker_dependency_cache).
MODEL_CACHE = Path(os.environ.get("SEARCH_MODEL_CACHE", "/tmp/windmill/cache/search-models"))


@dataclass(frozen=True)
class ModelFile:
    path: str
    sha256: str


@dataclass(frozen=True)
class EncoderModel:
    repo: str
    revision: str
    onnx: ModelFile
    tokenizer: ModelFile
    pooling: str  # "cls" or "mean"
    dimensions: int


BGE_BASE_EN = EncoderModel(
    repo="BAAI/bge-base-en-v1.5",
    revision="a5beb1e3e68b9ab74eb54cfd186867f64f240e1a",
    onnx=ModelFile("onnx/model.onnx", "9bc579acdba21c253c62a9bf866891355a63ffa3442b52c8a37d75b2ccb91848"),
    tokenizer=ModelFile("tokenizer.json", "d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66"),
    pooling="cls",
    dimensions=768,
)
MULTILINGUAL_E5_SMALL = EncoderModel(
    repo="intfloat/multilingual-e5-small",
    revision="614241f622f53c4eeff9890bdc4f31cfecc418b3",
    onnx=ModelFile("onnx/model.onnx", "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665"),
    tokenizer=ModelFile("tokenizer.json", "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"),
    pooling="mean",
    dimensions=384,
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def model_file(model: EncoderModel, file: ModelFile) -> Path:
    """The cached file, downloaded and verified first if it's missing."""
    target = MODEL_CACHE / model.repo / model.revision / file.path
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    # Two jobs on the same host must not download into the same partial file.
    with open(target.parent / ".lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if target.exists():
            return target
        partial = target.with_name(target.name + ".partial")
        url = f"https://huggingface.co/{model.repo}/resolve/{model.revision}/{file.path}"
        print(f"Downloading {url}", flush=True)
        with urllib.request.urlopen(url, timeout=60) as response, open(partial, "wb") as out:
            while block := response.read(1 << 20):
                out.write(block)
        actual = _sha256(partial)
        if actual != file.sha256:
            partial.unlink()
            raise RuntimeError(f"{model.repo} {file.path}: sha256 {actual}, expected {file.sha256}")
        os.replace(partial, target)
    return target


class TextEncoder:
    """One loaded model. Load one at a time and `close()` it before loading the next."""

    def __init__(self, model: EncoderModel, threads: int = THREADS) -> None:
        self.model = model
        self.tokenizer = Tokenizer.from_file(str(model_file(model, model.tokenizer)))
        self.tokenizer.enable_truncation(MAX_TOKENS)
        self.tokenizer.no_padding()
        pad_id = self.tokenizer.token_to_id("[PAD]")
        self.pad_id = pad_id if pad_id is not None else self.tokenizer.token_to_id("<pad>")
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            str(model_file(model, model.onnx)), options, providers=["CPUExecutionProvider"],
        )
        self.input_names = {i.name for i in self.session.get_inputs()}

    def encode(self, texts: list[str]) -> np.ndarray:
        """L2-normalized float32 vectors in the order of `texts`."""
        out = np.zeros((len(texts), self.model.dimensions), np.float32)
        if not texts:
            return out
        encodings = self.tokenizer.encode_batch(texts)
        # Sorting by length keeps padding small; the pooling ignores padding either way.
        order = np.argsort([len(e.ids) for e in encodings], kind="stable")
        for start in range(0, len(order), BATCH_SIZE):
            rows = order[start:start + BATCH_SIZE]
            batch = [encodings[i] for i in rows]
            length = max(len(e.ids) for e in batch)
            ids = np.full((len(batch), length), self.pad_id, np.int64)
            mask = np.zeros((len(batch), length), np.int64)
            for i, e in enumerate(batch):
                ids[i, :len(e.ids)] = e.ids
                mask[i, :len(e.ids)] = 1
            feed = {"input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)}
            hidden = self.session.run(None, {k: v for k, v in feed.items() if k in self.input_names})[0]
            if self.model.pooling == "cls":
                vectors = hidden[:, 0]
            else:
                weights = mask[..., None].astype(np.float32)
                vectors = (hidden * weights).sum(1) / np.maximum(weights.sum(1), 1e-9)
            out[rows] = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        return out

    def close(self) -> None:
        self.session = None
        gc.collect()


def encode(model: EncoderModel, texts: list[str]) -> np.ndarray:
    """Load `model`, encode `texts`, and free the model again."""
    encoder = TextEncoder(model)
    try:
        return encoder.encode(texts)
    finally:
        encoder.close()


def main() -> None:
    """Shared module; no standalone input."""
