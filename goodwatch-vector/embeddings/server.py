from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch
import traceback
from typing import Dict, List
import logging
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig # Added for LLM

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Embeddings and Generation Server")

# --- Constants ---
MAX_TEXT_LENGTH = 8192     # Maximum *characters* per text input for embeddings (adjust if needed)
MAX_BATCH_SIZE = 1000      # Maximum number of texts per embedding request
MAX_OUTPUT_TOKENS = 512    # Maximum new tokens to generate with the LLM

# --- Device Configuration ---
# Prefer CUDA if available, otherwise use CPU
# Note: Running LLMs on CPU will be slow.
# Quantization helps with memory but not necessarily speed on CPU.
if torch.cuda.is_available():
    device = torch.device("cuda")
    # Check available VRAM for LLM loading
    try:
        gpu_props = torch.cuda.get_device_properties(0)
        logger.info(f"CUDA detected. Using device: {device} ({gpu_props.name}, {gpu_props.total_memory / (1024**3):.2f} GB VRAM)")
    except Exception as e:
        logger.warning(f"Could not get CUDA device properties: {e}")
        device = torch.device("cpu")
        logger.info("Falling back to CPU.")

else:
    device = torch.device("cpu")
    logger.info("CUDA not available. Using device: CPU")

# --- Model Loading ---

# Embedding Model (v2 from original code)
embedding_model_name = "czesty/ea-setfit-v1-classifier"
llm_model_name = "google/gemma-2b-it" # Using Gemma 2B instruction-tuned

models = {}
llm_components = {} # To store LLM model and tokenizer

# Load Embedding Model
try:
    logger.info(f"Loading embedding model: {embedding_model_name} onto device: {device}")
    # Explicitly set device for sentence-transformers
    embedding_device = 'cuda' if device.type == 'cuda' else 'cpu'
    models['embedding'] = SentenceTransformer(embedding_model_name, device=embedding_device)
    logger.info("Embedding model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load embedding model '{embedding_model_name}': {e}", exc_info=True)
    # Decide if you want the server to start without the embedding model
    # raise e # Uncomment to prevent server startup on failure

# Load LLM Model (with Quantization)
try:
    logger.info(f"Loading LLM model: {llm_model_name} onto device: {device}")

    # Configure 4-bit quantization
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16, # Use float16 for computation
        bnb_4bit_quant_type="nf4",           # Use NF4 quantization type
        bnb_4bit_use_double_quant=True,      # Use double quantization
    )

    # Load tokenizer
    llm_tokenizer = AutoTokenizer.from_pretrained(llm_model_name)
    logger.info("LLM Tokenizer loaded.")

    # Load model with quantization config and device map
    # device_map='auto' lets transformers handle device placement (CPU/GPU)
    llm_model = AutoModelForCausalLM.from_pretrained(
        llm_model_name,
        #quantization_config=quantization_config,
        torch_dtype=torch.float16, # Load weights in float16 to save memory (will be quantized anyway)
        device_map="auto",         # Automatically distribute across available devices (CPU/GPU)
        # low_cpu_mem_usage=True,  # Try to minimize CPU memory usage during loading (may require accelerate >= 0.14.0)
    )
    logger.info("LLM model loaded successfully with 4-bit quantization.")

    llm_components['tokenizer'] = llm_tokenizer
    llm_components['model'] = llm_model
    llm_components['device'] = device # Store the primary device decision

except ImportError:
    logger.error("Failed to load LLM: `bitsandbytes` or `accelerate` library not found. Please install them (`pip install bitsandbytes accelerate`). LLM functionality will be disabled.")
except Exception as e:
    logger.error(f"Failed to load LLM model '{llm_model_name}': {e}", exc_info=True)
    # Decide if you want the server to start without the LLM model
    # raise e # Uncomment to prevent server startup on failure

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

def get_llm_components():
    if 'model' not in llm_components or 'tokenizer' not in llm_components:
        raise HTTPException(status_code=503, detail="LLM model or tokenizer is not available.")
    return llm_components['model'], llm_components['tokenizer'], llm_components['device']

# --- Embedding Logic --- (Simplified: No version parameter)

def generate_single_embedding(text: str) -> List[float]:
    """Generates embedding for a single text using the loaded embedding model."""
    try:
        model = get_embedding_model()
        # Determine the correct device for sentence-transformers
        embedding_device = 'cuda' if device.type == 'cuda' else 'cpu'
        # Note: SentenceTransformer handles device placement internally if specified at init
        embedding = model.encode(text, convert_to_tensor=False, show_progress_bar=False) # Get numpy array directly
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Error in generate_single_embedding: {e}", exc_info=True)
        # Don't raise HTTPException here, let the endpoint handle it
        raise e # Re-raise the original exception

def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """Generates embeddings for a batch of texts using the loaded embedding model."""
    try:
        model = get_embedding_model()
        # Determine the correct device for sentence-transformers
        embedding_device = 'cuda' if device.type == 'cuda' else 'cpu'
         # Note: SentenceTransformer handles device placement internally if specified at init
        embeddings = model.encode(texts, convert_to_tensor=False, show_progress_bar=False, batch_size=min(len(texts), 32)) # Get numpy arrays directly, adjust batch_size as needed
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        logger.error(f"Error in generate_batch_embeddings: {e}", exc_info=True)
        # Don't raise HTTPException here, let the endpoint handle it
        raise e # Re-raise the original exception

# --- LLM Generation Logic ---

def generate_text(prompt: str, max_new_tokens: int) -> str:
    """Generates text using the loaded LLM."""
    try:
        model, tokenizer, llm_device = get_llm_components()

        # Gemma instruction format (adjust if using a different model)
        # '<bos>' and '<eos>' are often added automatically by the tokenizer
        input_text = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
        # Note: some tokenizers add bos automatically, some don't. Check model card.
        # For Gemma, tokenizer usually adds bos but not eos to prompt.

        inputs = tokenizer(input_text, return_tensors="pt").to(model.device) # Move inputs to the model's device

        # Generate text
        # Use torch.inference_mode() for efficiency
        with torch.inference_mode():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True, # Enable sampling for more creative output
                temperature=0.7, # Control randomness (lower = more deterministic)
                top_k=50,        # Consider top K tokens
                top_p=0.9,       # Use nucleus sampling
                pad_token_id=tokenizer.eos_token_id # Important for generation
            )

        # Decode the generated tokens, skipping special tokens and the prompt
        # Important: Slice the output tensor to only decode the *newly generated* tokens
        generated_ids = outputs[0, inputs['input_ids'].shape[1]:]
        result = tokenizer.decode(generated_ids, skip_special_tokens=True)

        return result.strip()

    except Exception as e:
        logger.error(f"Error during text generation: {e}", exc_info=True)
        raise e # Re-raise the original exception


# --- API Endpoints ---

@app.get("/health")
async def health_check():
    # Basic health check
    health_status = {"status": "ok", "models_loaded": {}}
    health_status["models_loaded"]["embedding"] = 'embedding' in models
    health_status["models_loaded"]["llm"] = 'model' in llm_components and 'tokenizer' in llm_components
    return health_status

# Kept original v2 paths for compatibility
@app.post("/v2/embedding")
async def embedding_single_v2(input_data: EmbeddingInput):
    """Generates an embedding for a single text input."""
    try:
        # Basic input validation (FastAPI handles Pydantic validation)
        if not input_data.text:
             raise HTTPException(status_code=400, detail="Input text cannot be empty.")
        if len(input_data.text) > MAX_TEXT_LENGTH * 1.5: # Heuristic check for very long text
             logger.warning(f"Input text length ({len(input_data.text)}) is large, might cause issues.")
             # You might want a stricter limit depending on model/memory

        embedding = generate_single_embedding(input_data.text)
        return {"embedding": embedding}
    except HTTPException as http_ex:
        # Re-raise known HTTP exceptions
        raise http_ex
    except Exception as e:
        logger.error(f"Error processing single embedding request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during embedding generation: {e}")

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
            text = texts[key]
            if not isinstance(text, str):
                 raise HTTPException(status_code=400, detail=f"Value for key '{key}' must be a string.")
            if not text:
                 raise HTTPException(status_code=400, detail=f"Text for key '{key}' cannot be empty.")
            if len(text) > MAX_TEXT_LENGTH * 1.5: # Heuristic check
                logger.warning(f"Text for key '{key}' length ({len(text)}) is large.")
                 # You might add a hard limit here too
            text_list.append(text)

        embeddings_list = generate_batch_embeddings(text_list)
        result = {key: embedding for key, embedding in zip(keys, embeddings_list)}
        return result

    except HTTPException as http_ex:
        # Re-raise known HTTP exceptions
        raise http_ex
    except Exception as e:
        logger.error(f"Error processing batch embedding request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during batch embedding generation: {e}")


@app.post("/generate")
async def generate_llm_text(input_data: GenerationInput):
    """Generates text based on a prompt using the LLM."""
    try:
        if not input_data.prompt:
            raise HTTPException(status_code=400, detail="Input prompt cannot be empty.")

        # Validate max_new_tokens
        max_tokens = min(input_data.max_new_tokens, MAX_OUTPUT_TOKENS * 2) # Allow some flexibility but cap it reasonably
        if max_tokens <= 0:
             raise HTTPException(status_code=400, detail="max_new_tokens must be positive.")

        logger.info(f"Generating text for prompt (first 50 chars): '{input_data.prompt[:50]}...' with max_new_tokens={max_tokens}")
        generated_text = generate_text(input_data.prompt, max_tokens)
        logger.info(f"Generated text (first 50 chars): '{generated_text[:50]}...'")
        return {"generated_text": generated_text}

    except HTTPException as http_ex:
        # Re-raise known HTTP exceptions
        raise http_ex
    except Exception as e:
        logger.error(f"Error processing generation request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during text generation: {e}")
