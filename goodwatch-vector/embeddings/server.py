import fastapi
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import traceback
from typing import Dict, List, Any # Added Any
import logging
import os

# Import Llama and downloader
from llama_cpp import Llama, LlamaGrammar # Import Llama and LlamaGrammar
from huggingface_hub import hf_hub_download # Import downloader
from starlette.concurrency import run_in_threadpool

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Embeddings and Generation Server (llama-cpp-python)")

# --- Constants ---
MAX_TEXT_LENGTH = 8192     # Maximum *characters* per text input for embeddings
MAX_BATCH_SIZE = 1000      # Maximum number of texts per embedding request
MAX_OUTPUT_TOKENS = 512    # Default maximum new tokens for LLM generation

# --- Model Configuration (Read from Environment - Set by docker-compose) ---
EMBEDDING_MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "czesty/ea-setfit-v1-classifier")
LLM_MODEL_REPO_ID = os.environ.get("LLM_MODEL_REPO_ID", "google/gemma-3-1b-it-qat-q4_0-gguf")
LLM_MODEL_FILENAME = os.environ.get("LLM_MODEL_FILENAME", "gemma-3-1b-it-q4_0.gguf")
HUGGING_FACE_HUB_TOKEN = os.environ.get("HUGGING_FACE_HUB_TOKEN") # For download

# --- Device Configuration & Thread Count ---
if torch.cuda.is_available():
    embedding_device_type = "cuda"
    # ... (rest of CUDA check logging) ...
else:
    embedding_device_type = "cpu"
    logger.info("CUDA not available. Using CPU for embeddings.")

cpu_count = os.cpu_count() or 1
llama_threads = max(1, int(cpu_count * 0.75)) # Use 75% of cores
logger.info(f"Using {llama_threads} threads for llama.cpp LLM ({LLM_MODEL_REPO_ID}).")

# --- Model Loading ---
models = {}
llm_components = {} # Store Llama instance and model path

# Load Embedding Model
try:
    logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME} onto device: {embedding_device_type}")
    models['embedding'] = SentenceTransformer(EMBEDDING_MODEL_NAME, device=embedding_device_type)
    logger.info("Embedding model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load embedding model '{EMBEDDING_MODEL_NAME}': {e}", exc_info=True)
    # raise e

# Load LLM Model (using llama-cpp-python)
# Download first (if not preloaded or cache missing), then load
try:
    logger.info(f"Ensuring GGUF LLM model is available: {LLM_MODEL_REPO_ID}/{LLM_MODEL_FILENAME}")
    if "google/" in LLM_MODEL_REPO_ID and not HUGGING_FACE_HUB_TOKEN:
        raise ValueError("HUGGING_FACE_HUB_TOKEN environment variable is required to download official Google models.")

    # Download the model file using huggingface_hub, it handles caching
    model_path = hf_hub_download(
        repo_id=LLM_MODEL_REPO_ID,
        filename=LLM_MODEL_FILENAME,
        token=HUGGING_FACE_HUB_TOKEN,
        resume_download=True
    )
    logger.info(f"GGUF model path: {model_path}")

    # Load the model using llama_cpp.Llama
    llm = Llama(
        model_path=model_path,
        n_ctx=8192,           # Context window size
        n_gpu_layers=0,       # Force CPU
        n_threads=llama_threads,  # Number of CPU threads
        verbose=False         # Set True for Llama.cpp internal logging
    )
    llm_components['llm'] = llm
    llm_components['model_path'] = model_path # Store path for reference
    logger.info(f"llama.cpp LLM model loaded successfully from {model_path}.")

except Exception as e:
    logger.error(f"Failed to download or load GGUF LLM model '{LLM_MODEL_REPO_ID}/{LLM_MODEL_FILENAME}': {e}", exc_info=True)
    if "google/" in LLM_MODEL_REPO_ID and ('401' in str(e) or 'gated' in str(e).lower() or 'authentication' in str(e).lower()):
         logger.error("!!! This is likely an AUTHENTICATION ERROR. Ensure token is valid and Gemma terms were accepted. !!!")
    # LLM is not critical for server startup, endpoints will check availability
    # raise e

# --- Pydantic Models ---
class EmbeddingInput(BaseModel):
    text: str

class GenerationInput(BaseModel):
    prompt: str
    max_new_tokens: int = MAX_OUTPUT_TOKENS # Allow overriding default max tokens

# --- Helper Functions ---
def get_embedding_model():
    if 'embedding' not in models:
        raise HTTPException(status_code=503, detail="Embedding model is not available.")
    return models['embedding']

def get_llm():
    if 'llm' not in llm_components:
        error_detail = "LLM model is not available (failed to load during startup)."
        raise HTTPException(status_code=503, detail=error_detail)
    return llm_components['llm']

# --- Embedding Logic ---
def generate_single_embedding(text: str) -> List[float]:
    """Generates embedding for a single text using the loaded embedding model."""
    try:
        model = get_embedding_model()
        embedding = model.encode(text, convert_to_tensor=False, show_progress_bar=False)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Error in generate_single_embedding: {e}", exc_info=True)
        raise e

def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """Generates embeddings for a batch of texts using the loaded embedding model."""
    try:
        model = get_embedding_model()
        embeddings = model.encode(texts, convert_to_tensor=False, show_progress_bar=False, batch_size=min(len(texts), 32))
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        logger.error(f"Error in generate_batch_embeddings: {e}", exc_info=True)
        raise e

# --- LLM Generation Logic (with Thread Pooling) ---
def _run_llm_generation(llm: Llama, messages: List[Dict[str, str]], max_tokens: int):
    """Synchronous function containing the blocking llama.cpp call using chat completion."""
    try:
        logger.debug(f"Starting llama.cpp chat completion with max_tokens={max_tokens}")
        # Use create_chat_completion for instruction-tuned models
        completion = llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            top_k=50,
            stop=["<end_of_turn>", "<eos>"], # Common stop tokens for Gemma
            # Add other parameters like repetition_penalty if needed
            # repetition_penalty=1.1
        )
        logger.debug("llama.cpp chat completion finished.")
        # Extract the generated text
        if completion and 'choices' in completion and len(completion['choices']) > 0:
             content = completion['choices'][0].get('message', {}).get('content')
             return content.strip() if content else ""
        else:
             logger.warning("LLM completion did not return expected structure.")
             return ""
    except Exception as e:
        logger.error(f"Error during underlying llama.cpp generation: {e}", exc_info=True)
        raise e # Re-raise to be caught by the endpoint handler

async def generate_text(prompt: str, max_new_tokens: int) -> str:
    """
    Generates text using the loaded GGUF LLM via llama-cpp-python,
    running the blocking call in FastAPI/Starlette's thread pool.
    """
    try:
        llm = get_llm() # Will raise 503 if LLM not loaded

        # Prepare messages in the format llama-cpp-python expects for chat completion
        # This usually mirrors OpenAI's format. Gemma doesn't use a system prompt typically.
        messages = [
            {"role": "user", "content": prompt},
        ]
        # Note: llama-cpp-python might apply the model's specific chat template automatically
        # based on model metadata, so manual formatting like adding <start_of_turn>
        # might not be necessary here - test to confirm. Start without it.

        logger.info(f"Dispatching llama.cpp generation task to thread pool (max_tokens={max_new_tokens})...")
        result = await run_in_threadpool(
            _run_llm_generation,
            llm=llm,
            messages=messages,
            max_tokens=max_new_tokens
        )
        logger.info("Generation task completed by thread pool.")
        return result

    except Exception as e:
        logger.error(f"Error in generate_text async function: {e}", exc_info=True)
        raise e


# --- API Endpoints ---
@app.get("/health")
async def health_check():
    """Basic health check reporting status of loaded models."""
    health_status = {"status": "ok", "models_loaded": {}}
    health_status["models_loaded"]["embedding"] = 'embedding' in models
    health_status["models_loaded"]["llm"] = 'llm' in llm_components
    if 'llm' not in llm_components:
         # Add more detail if loading failed vs. just not present
         health_status["llm_status"] = "LLM failed to load during startup or is unavailable."
    return health_status

# Kept original v2 paths for embedding compatibility
@app.post("/v2/embedding")
async def embedding_single_v2(input_data: EmbeddingInput):
    """Generates an embedding for a single text input."""
    try:
        if not input_data.text:
             raise HTTPException(status_code=400, detail="Input text cannot be empty.")
        # Simple length check (optional)
        if len(input_data.text) > MAX_TEXT_LENGTH * 2:
             logger.warning(f"Input text length ({len(input_data.text)}) is very large.")

        embedding = generate_single_embedding(input_data.text)
        return {"embedding": embedding}
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        # Avoid leaking raw exception details in production if sensitive
        logger.error(f"Error processing single embedding request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during embedding generation.")

@app.post("/v2/embeddings")
async def embeddings_batch_v2(texts: Dict[str, str] = Body(...)):
    """Generates embeddings for a batch of texts provided as a JSON object (key: text)."""
    try:
        if not texts:
            raise HTTPException(status_code=400, detail="Input dictionary cannot be empty.")
        if len(texts) > MAX_BATCH_SIZE:
            logger.warning(f"Batch size ({len(texts)}) exceeds the limit of {MAX_BATCH_SIZE}.")
            raise HTTPException(status_code=400, detail=f"Batch size exceeds the maximum limit of {MAX_BATCH_SIZE}.")

        keys = list(texts.keys())
        text_list = []
        for key in keys:
            text = texts.get(key) # Use .get for safer access
            if not isinstance(text, str):
                 raise HTTPException(status_code=400, detail=f"Value for key '{key}' must be a string.")
            if not text: # Check for empty string
                 logger.warning(f"Empty text provided for key '{key}'.")
                 # Decide if you want to allow empty strings or raise error
                 # raise HTTPException(status_code=400, detail=f"Text for key '{key}' cannot be empty.")
            # Simple length check (optional)
            if len(text) > MAX_TEXT_LENGTH * 2:
                logger.warning(f"Text for key '{key}' length ({len(text)}) is very large.")
            text_list.append(text)

        embeddings_list = generate_batch_embeddings(text_list)
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.error(f"Error processing batch embedding request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during batch embedding generation.")


@app.post("/generate")
async def generate_llm_text_endpoint(input_data: GenerationInput):
    """
    Generates text based on a prompt using the GGUF LLM via ctransformers,
    handling the blocking call asynchronously using a thread pool.
    """
    # Check LLM availability early
    try:
        get_llm() # Will raise 503 if not available
    except HTTPException as http_ex:
        raise http_ex

    try:
        if not input_data.prompt:
            raise HTTPException(status_code=400, detail="Input prompt cannot be empty.")

        max_tokens = min(input_data.max_new_tokens, MAX_OUTPUT_TOKENS * 2) # Cap flexibility
        if max_tokens <= 0:
             raise HTTPException(status_code=400, detail="max_new_tokens must be positive.")

        logger.info(f"Received generation request (prompt starts: '{input_data.prompt[:50]}...', max_new_tokens={max_tokens})")
        generated_text = await generate_text(input_data.prompt, max_tokens)
        logger.info(f"Successfully generated text (starts: '{generated_text[:50]}...')")
        return {"generated_text": generated_text}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.error(f"Unhandled error processing generation request: {e}", exc_info=True)
        # Consider more generic error message for clients
        raise HTTPException(status_code=500, detail="Internal server error during text generation.")

# --- Optional: Run directly (for testing without Docker/Uvicorn command line) ---
# if __name__ == "__main__":
#     import uvicorn
#     # NOTE: This does NOT set multiple workers. Workers are set via CLI.
#     uvicorn.run(app, host="0.0.0.0", port=8000)