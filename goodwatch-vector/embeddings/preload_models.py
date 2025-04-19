import os
import logging
import torch # Still potentially useful
from sentence_transformers import SentenceTransformer
from llama_cpp import Llama # Import Llama
from huggingface_hub import hf_hub_download # Import downloader

# Setup basic logging for the preload script
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Preloader")

# --- Environment Variables ---
embedding_model_name = os.environ.get('EMBEDDING_MODEL_NAME')
llm_repo_id = os.environ.get('LLM_MODEL_REPO_ID')
llm_filename = os.environ.get('LLM_MODEL_FILENAME')
token = os.environ.get('HUGGING_FACE_HUB_TOKEN') # Needed for official Google model download

# --- Preload Embedding Model ---
if not embedding_model_name:
    logger.error("EMBEDDING_MODEL_NAME not set, skipping embedding preload.")
else:
    try:
        logger.info(f'--- Preloading sentence transformer: {embedding_model_name} ---')
        SentenceTransformer(embedding_model_name)
        logger.info('--- Sentence transformer loaded successfully ---')
    except Exception as e:
        logger.error(f"*** ERROR: Failed to preload embedding model {embedding_model_name}: {e} ***", exc_info=True)
        # raise e # Decide if build should fail

# --- Preload LLM Model ---
if not llm_repo_id or not llm_filename:
    logger.error("LLM Repo ID or Filename not set, skipping LLM preload.")
else:
    # Check token only if it's a google repo, as it's mandatory
    if "google/" in llm_repo_id and not token:
         logger.error('*** FATAL ERROR: HUGGING_FACE_HUB_TOKEN is not set. Preloading official Google model will fail! ***')
         raise ValueError("HUGGING_FACE_HUB_TOKEN is required for official Google models.")

    logger.info(f'--- Downloading GGUF model: {llm_repo_id}/{llm_filename} ---')
    try:
        # Explicitly download the GGUF file first
        model_path = hf_hub_download(
            repo_id=llm_repo_id,
            filename=llm_filename,
            local_dir=None, # Let huggingface_hub manage cache path
            token=token,
            resume_download=True
        )
        logger.info(f"GGUF file downloaded to: {model_path}")

        logger.info(f'--- Verifying GGUF model load: {model_path} ---')
        cpu_count = os.cpu_count() or 1
        n_threads = max(1, int(cpu_count * 0.75)) # Use 75% of cores

        # Load the model using llama_cpp.Llama from the downloaded path
        # This also verifies the file is loadable by the library
        llm = Llama(
            model_path=model_path,
            n_ctx=8192,      # Context size (Gemma 3 1B supports 32k max)
            n_gpu_layers=0,  # Ensure CPU execution
            n_threads=n_threads,
            verbose=False    # Set to True for more llama.cpp logging if needed
        )
        # We don't need to keep llm loaded here, just verify it loads
        del llm
        logger.info('--- llama-cpp-python loaded GGUF model successfully ---')

    except Exception as e:
        logger.error(f'*** FATAL ERROR Preloading/Verifying GGUF {llm_repo_id}/{llm_filename}: {e} ***', exc_info=True)
        if "google/" in llm_repo_id and ('401' in str(e) or 'gated' in str(e).lower() or 'authentication' in str(e).lower()):
            logger.error('*** This looks like an AUTHENTICATION ERROR. Ensure HUGGING_FACE_HUB_TOKEN build-arg was provided, is valid, and the associated account accepted Gemma terms. ***')
        # Fail the build if LLM preload fails
        raise e

logger.info("--- Model preloading script finished ---")