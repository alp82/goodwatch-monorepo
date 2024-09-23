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
MAX_BATCH_SIZE = 32        # Maximum number of texts per request

# Device configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# Load the model and tokenizer
model_name = "jinaai/jina-embeddings-v2-small-en"
model = SentenceTransformer(model_name, device=device)

class TextInput(BaseModel):
    text: str

def get_embedding(text: str) -> List[float]:
    try:
        # Generate embedding
        embedding = model.encode(text, convert_to_tensor=True, show_progress_bar=False)
        # Convert to list
        embedding = embedding.cpu().tolist()
        return embedding
    except Exception as e:
        logger.error(f"Error in get_embedding: {e}")
        raise e

def get_embeddings(texts: List[str]) -> List[List[float]]:
    try:
        # Generate embeddings
        embeddings = model.encode(texts, convert_to_tensor=True, show_progress_bar=False, batch_size=MAX_BATCH_SIZE)
        # Convert to list
        embeddings = embeddings.cpu().tolist()
        return embeddings
    except Exception as e:
        logger.error(f"Error in get_embeddings: {e}")
        raise e

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/embedding")
async def embedding_single(input: TextInput):
    try:
        embedding = get_embedding(input.text)
        return {"embedding": embedding}
    except Exception as e:
        logger.error(f"Error in /embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embeddings")
async def embeddings_batch(texts: Dict[str, str] = Body(...)):
    try:
        if len(texts) > MAX_BATCH_SIZE:
            logger.error(f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")
            raise HTTPException(status_code=400, detail=f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")

        keys = list(texts.keys())
        text_list = [texts[key] for key in keys]

        # Optional: Check individual text lengths (in characters)
        for idx, text in enumerate(text_list):
            if len(text) > MAX_TEXT_LENGTH:
                logger.error(f"Text '{keys[idx]}' exceeds the maximum allowed length.")
                raise HTTPException(status_code=400, detail=f"Text '{keys[idx]}' exceeds the maximum allowed length.")

        embeddings_list = get_embeddings(text_list)
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result
    except HTTPException as http_ex:
        logger.error(f"HTTP exception in /embeddings: {http_ex.detail}")
        raise http_ex  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Unhandled exception in /embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))