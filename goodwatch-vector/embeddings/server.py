from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
from typing import Dict, List
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BAAI/bge-m3 Embeddings Server")

# Constants
MAX_TEXT_LENGTH = 8192     # Maximum tokens per text input
MAX_BATCH_SIZE = 30        # Maximum number of texts per request

# Load the model and tokenizer
model_name = "BAAI/bge-m3"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

class TextInput(BaseModel):
    text: str

def get_embedding(text: str) -> List[float]:
    try:
        inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
        return embeddings
    except Exception as e:
        logger.error(f"Error in get_embedding: {e}")
        raise e

def get_embeddings(texts: List[str]) -> List[List[float]]:
    all_embeddings = []
    for idx, text in enumerate(texts):
        try:
            logger.info(f"Processing text {idx + 1}/{len(texts)}")
            embedding = get_embedding(text)
            all_embeddings.append(embedding)
        except Exception as e:
            logger.error(f"Error processing text {idx + 1}: {e}")
            raise e
    return all_embeddings

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/embedding")
async def embedding_text(input: TextInput):
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

        # Check individual text lengths
        for idx, text in enumerate(text_list):
            tokenized_length = len(tokenizer.tokenize(text))
            if tokenized_length > MAX_TEXT_LENGTH:
                logger.error(f"Text {keys[idx]} exceeds the maximum allowed length.")
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
