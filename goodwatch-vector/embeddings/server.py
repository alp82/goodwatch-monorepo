# main.py

from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
from typing import Dict, List

app = FastAPI(title="BAAI/bge-m3 Embeddings Server")

# Constants
MAX_TEXT_LENGTH = 8192              # Maximum tokens per text input
MAX_BATCH_SIZE = 100                # Maximum number of texts per request
EMBEDDING_BATCH_SIZE = 4    # Maximum embedding generations per tokenizer

# Load the model and tokenizer
model_name = "BAAI/bge-m3"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

class TextInput(BaseModel):
    text: str

def get_embedding(text: str) -> List[float]:
    inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
    return embeddings

def get_embeddings(texts: List[str]) -> List[List[float]]:
    all_embeddings = []
    for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch_texts = texts[i:i + EMBEDDING_BATCH_SIZE]
        inputs = tokenizer(batch_texts, return_tensors='pt', truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        embeddings = outputs.last_hidden_state.mean(dim=1).tolist()
        all_embeddings.extend(embeddings)
    return all_embeddings


@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify that the server is running.
    Returns a simple status message.
    """
    return {"status": "ok"}

@app.post("/embedding")
async def embedding_text(input: TextInput):
    """
    Endpoint to get the embedding of a single text input.
    """
    try:
        embedding = get_embedding(input.text)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embeddings")
async def embeddings_batch(texts: Dict[str, str] = Body(...)):
    """
    Accepts a dictionary of texts and returns embeddings with the same keys.
    Example Input:
    {
        "key1": "text1",
        "key2": "text2"
    }
    """
    try:
        if len(texts) > MAX_BATCH_SIZE:
            raise HTTPException(status_code=400, detail=f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")

        keys = list(texts.keys())
        text_list = [texts[key] for key in keys]

        # Optional: Check individual text lengths (in tokens)
        for text in text_list:
            tokenized = tokenizer.tokenize(text)
            if len(tokenized) > MAX_TEXT_LENGTH:
                raise HTTPException(status_code=400, detail="One or more texts exceed the maximum allowed length.")

        embeddings_list = get_embeddings(text_list)
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result
    except HTTPException as http_ex:
        raise http_ex  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))