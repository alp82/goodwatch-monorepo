# main.py

from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
import torch
from typing import Dict, List

app = FastAPI(title="BAAI/bge-m3 Embeddings Server")

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
    inputs = tokenizer(texts, return_tensors='pt', truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state.mean(dim=1).tolist()
    return embeddings

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
        keys = list(texts.keys())
        text_list = [texts[key] for key in keys]
        embeddings_list = get_embeddings(text_list)
        # Build the result dict with the same keys
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
