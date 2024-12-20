from typing import Literal, Optional
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import traceback
from typing import Dict, List
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Embeddings Server")

# Constants
MAX_TEXT_LENGTH = 8192     # Maximum tokens per text input
MAX_BATCH_SIZE = 1000      # Maximum number of texts per request

# Device configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# Load the models
model_name_v1 = "jinaai/jina-embeddings-v2-small-en"
model_name_v2 = "czesty/ea-setfit-v1-classifier"
models = {
    "v1": SentenceTransformer(model_name_v1, device=device),
    "v2": SentenceTransformer(model_name_v2, device=device),
}

Version = Literal['v1', 'v2']

class TextInput(BaseModel):
    text: str

def get_model(version: Version):
    if version not in models:
        raise ValueError(f"Unsupported version: {version}")
    return models[version]

def get_embedding(text: str, version: Version = 'v1') -> List[float]:
    try:
        model = get_model(version)
        embedding = model.encode(text, convert_to_tensor=True, show_progress_bar=False)
        return embedding.cpu().tolist()
    except Exception as e:
        logger.error(f"Error in get_embedding (version={version}): {e}")
        raise e

def get_embeddings(texts: List[str], version: Version = 'v1') -> List[List[float]]:
    try:
        model = get_model(version)
        embeddings = model.encode(texts, convert_to_tensor=True, show_progress_bar=False, batch_size=MAX_BATCH_SIZE)
        return embeddings.cpu().tolist()
    except Exception as e:
        logger.error(f"Error in get_embeddings (version={version}): {e}")
        raise e

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/embedding")
async def embedding_single(input: TextInput, version: Version = 'v1'):
    try:
        embedding = get_embedding(input.text, version)
        return {"embedding": embedding}
    except Exception as e:
        logger.error(f"Error in /embedding (version={version}): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embeddings")
async def embeddings_batch(texts: Dict[str, str] = Body(...), version: Version = 'v1'):
    try:
        if len(texts) > MAX_BATCH_SIZE:
            logger.error(f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")
            raise HTTPException(status_code=400, detail=f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")

        keys = list(texts.keys())
        text_list = [texts[key] for key in keys]

        for idx, text in enumerate(text_list):
            if len(text) > MAX_TEXT_LENGTH:
                logger.error(f"Text '{keys[idx]}' exceeds the maximum allowed length.")
                raise HTTPException(status_code=400, detail=f"Text '{keys[idx]}' exceeds the maximum allowed length.")

        embeddings_list = get_embeddings(text_list, version)
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result
    except HTTPException as http_ex:
        logger.error(f"HTTP exception in /embeddings (version={version}): {http_ex.detail}")
        raise http_ex
    except Exception as e:
        logger.error(f"Unhandled exception in /embeddings (version={version}): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v2/embedding")
async def embedding_single_v2(input: TextInput):
    return await embedding_single(input, version="v2")

@app.post("/v2/embeddings")
async def embeddings_batch_v2(texts: Dict[str, str] = Body(...)):
    return await embeddings_batch(texts, version="v2")
