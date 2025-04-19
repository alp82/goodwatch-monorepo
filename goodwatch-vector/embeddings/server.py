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
MAX_OUTPUT_TOKENS = 8192   # Default maximum new tokens for LLM generation

# --- Model Configuration (Read from Environment - Set by docker-compose) ---
EMBEDDING_MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "czesty/ea-setfit-v1-classifier")
LLM_MODEL_REPO_ID = os.environ.get("LLM_MODEL_REPO_ID", "google/gemma-3-1b-it-qat-q4_0-gguf")
LLM_MODEL_FILENAME = os.environ.get("LLM_MODEL_FILENAME", "gemma-3-1b-it-q4_0.gguf")
HUGGING_FACE_HUB_TOKEN = os.environ.get("HUGGING_FACE_HUB_TOKEN") # For download

DEFAULT_SYSTEM_PROMPT = """
**Objective:**



Your task is to generate a precise and semantically distinct set of analytical attributes for the provided movie or TV show. You will receive minimal input (title, year, summary) and must produce a JSON object containing only the specified fields, adhering strictly to the definitions, guidelines, and the **Radical Uniqueness Principle** outlined below. The goal is to create a detailed profile for understanding content characteristics, ensuring each attribute provides unique information.



**Input Format:**



You will receive input in the following JSON format:



```json

{

  "title": "Movie or TV Show Title",

  "year": ####, // Year of release

  "tmdb_id": ######, // Optional TMDB ID

  "summary": "A brief plot summary..." // Core context for your analysis

}

```



Output Format:

You MUST produce a single, valid JSON object containing ONLY the following structure and fields. Do not include any fields not listed here. Ensure all string values are properly escaped within the JSON.



{

  "classification": {

    "sub_genres_styles": [], // List of strings (Target: 2-5)

    "source_adaptation": null // String or null

  },

  "setting": {

    "time_periods": [], // List of strings (Target: 1-4)

    "locations": [] // List of strings (Target: 2-5)

  },

  "narrative_dna": {

    "plot_keywords_tropes": [], // List of strings (Target: 5-10)

    "themes": [], // List of strings (Target: 3-5)

    "narrative_structures": [], // List of strings (Target: 1-3)

    "character_archetypes": [] // List of strings (Target: 1-4)

  },

  "dimensional_scores": { // Integer scores from 1 to 10 for ALL 25 attributes

    "pacing": 0,

    "plot_complexity": 0,

    "cognitive_engagement": 0,

    "conventionality": 0,

    "narrative_predictability": 0,

    "narrative_resolution": 0,

    "character_depth": 0,

    "relationship_centrality": 0,

    "tone_seriousness": 0,

    "tone_outlook": 0,

    "emotional_intensity": 0,

    "humor_level": 0,

    "visual_stylization": 0,

    "auditory_emphasis": 0,

    "dialogue_density": 0,

    "realism_level": 0,

    "production_scale": 0,

    "social_political_commentary_prominence": 0,

    "thrill_suspense_level": 0,

    "scare_factor": 0,

    "disturbing_content_level": 0,

    "violence_gore_level": 0,

    "sexuality_nudity_level": 0,

    "profanity_level": 0,

    "target_audience_age_focus": 0

  },

  "aesthetic_sensory": {

    "dominant_moods": [], // List of strings (Target: 2-4)

    "humor_styles": [], // List of strings (Target: 1-5, if applicable)

    "visual_styles_techniques": [], // List of strings (Target: 3-7)

    "auditory_styles_elements": [], // List of strings (Target: 2-5)

    "dialogue_styles": [], // List of strings (Target: 1-3)

    "costume_set_design_styles": [] // List of strings (Target: 2-5)

  },

  "content_advisories": {

    "specific_warnings": [] // List of strings (As needed)

  },

  "impact_context": {

    "cultural_impact_markers": [], // List of strings (As needed)

    "relevant_movements_styles": [] // List of strings (As needed)

  }

}

```



Okay, we've done the groundwork, refined the strategy, and defined the structure and principles. Let's assemble the prompt.

This prompt is designed to instruct an LLM to take minimal input about a movie/TV show and generate a structured JSON containing detailed, distinct analytical attributes, adhering to the strict definitions and uniqueness principle we discussed.

Code snippet



**Objective:**



Your task is to generate a precise and semantically distinct set of analytical attributes for the provided movie or TV show. You will receive minimal input (title, year, summary) and must produce a JSON object containing only the specified fields, adhering strictly to the definitions, guidelines, and the **Radical Uniqueness Principle** outlined below. The goal is to create a detailed profile for understanding content characteristics, ensuring each attribute provides unique information.



**Input Format:**



You will receive input in the following JSON format:



```json

{

  "title": "Movie or TV Show Title",

  "year": ####, // Year of release

  "tmdb_id": ######, // Optional TMDB ID

  "summary": "A brief plot summary..." // Core context for your analysis

}

Output Format:

You MUST produce a single, valid JSON object containing ONLY the following structure and fields. Do not include any fields not listed here. Ensure all string values are properly escaped within the JSON.

JSON



{

  "classification": {

    "sub_genres_styles": [], // List of strings (Target: 2-5)

    "source_adaptation": null // String or null

  },

  "setting": {

    "time_periods": [], // List of strings (Target: 1-4)

    "locations": [] // List of strings (Target: 2-5)

  },

  "narrative_dna": {

    "plot_keywords_tropes": [], // List of strings (Target: 5-10)

    "themes": [], // List of strings (Target: 3-5)

    "narrative_structures": [], // List of strings (Target: 1-3)

    "character_archetypes": [] // List of strings (Target: 1-4)

  },

  "dimensional_scores": { // Integer scores from 1 to 10 for ALL 25 attributes

    "pacing": 0,

    "plot_complexity": 0,

    "cognitive_engagement": 0,

    "conventionality": 0,

    "narrative_predictability": 0,

    "narrative_resolution": 0,

    "character_depth": 0,

    "relationship_centrality": 0,

    "tone_seriousness": 0,

    "tone_outlook": 0,

    "emotional_intensity": 0,

    "humor_level": 0,

    "visual_stylization": 0,

    "auditory_emphasis": 0,

    "dialogue_density": 0,

    "realism_level": 0,

    "production_scale": 0,

    "social_political_commentary_prominence": 0,

    "thrill_suspense_level": 0,

    "scare_factor": 0,

    "disturbing_content_level": 0,

    "violence_gore_level": 0,

    "sexuality_nudity_level": 0,

    "profanity_level": 0,

    "target_audience_age_focus": 0

  },

  "aesthetic_sensory": {

    "dominant_moods": [], // List of strings (Target: 2-4)

    "humor_styles": [], // List of strings (Target: 1-5, if applicable)

    "visual_styles_techniques": [], // List of strings (Target: 3-7)

    "auditory_styles_elements": [], // List of strings (Target: 2-5)

    "dialogue_styles": [], // List of strings (Target: 1-3)

    "costume_set_design_styles": [] // List of strings (Target: 2-5)

  },

  "content_advisories": {

    "specific_warnings": [] // List of strings (As needed)

  },

  "impact_context": {

    "cultural_impact_markers": [], // List of strings (As needed)

    "relevant_movements_styles": [] // List of strings (As needed)

  }

}

Core Principles & Instructions:



Analyze Thoroughly: Use the provided summary and your internal knowledge base (as of April 2025) to analyze the work comprehensively. For TV series, consider the show overall, leaning towards its most representative state.

Generate ONLY Required Fields: Populate ONLY the fields specified in the Output Format above.

Radical Uniqueness Principle: THIS IS CRITICAL. Every attribute (tag or score) must provide unique semantic information not significantly overlapped by any other attribute. If a concept could fit multiple categories, assign it ONLY to the single most appropriate category based on the strict definitions below. Avoid redundant terms across different lists. Prioritize specificity.

Dimensional Scores (1-10): Assign an integer score from 1 to 10 for ALL 25 attributes listed under dimensional_scores. Adhere strictly to the definitions provided below. Score relatively across the entire spectrum of film and television, not just within the work's genre. 1 = absolute minimum observed; 10 = absolute maximum observed; 5/6 = typical/average. Base scores on observable characteristics.

Qualitative Tag Lists: For fields expecting lists of strings (e.g., themes, dominant_moods):Adhere to the target number of tags specified for each list. Select the most salient and distinct items.

Prioritize specificity over broadness. (e.g., Use "Quest for Lost Artifact" not "Adventure"; use "Critique of Capitalism" not "Society").

Ensure tags fit the strict definition of the category. (e.g., Do not put plot points in themes; do not put genre labels in dominant_moods).

Use concise, descriptive nouns or short phrases, typically capitalized unless common adjectives (like for moods).

Detailed Field Definitions & Guidelines:

(Provide the strict definitions and guidelines for EACH field the LLM needs to generate. Below are examples - expand these with the full definitions from Prompt 3 for scores and refined definitions for tags)



classification.sub_genres_styles:Role: Classification based on established cinematic conventions (form, structure, lineage, iconography).

Content: Labels like Film Noir, Slasher, Screwball Comedy, Biographical Drama, Absurdist Comedy, Space Opera, Mockumentary. Target 2-5.

Uniqueness: Describes the type of film according to genre theory. Distinct from plot elements or mood.

classification.source_adaptation:Role: Identify the origin of the material.

Content: Original Screenplay, Literary Adaptation, Comic Book Adaptation, Video Game Adaptation, Based on True Events, Remake, etc. Use null if unknown or not applicable.

setting.time_periods:Role: Describe the primary temporal setting(s).

Content: Specific eras, periods, or concepts. Present Day, 1980s, Medieval Era, Distant Future, Near Future, Alternate History, Victorian Era. Target 1-4.

setting.locations:Role: Describe the primary environmental or geographical setting(s).

Content: Types of environments or specific locations. Urban Cityscape, Rural Countryside, Space Station, Fantasy Kingdom, Small Town, Suburban Neighborhood, Jungle, Desert Landscape. Target 2-5.

narrative_dna.plot_keywords_tropes:Role: Identify concrete, tangible narrative components, events, objects, key character functions, or world-building elements.

Content: Specific nouns/short phrases. Time Loop, MacGuffin Quest, Sentient AI, Orphan Protagonist, Alien Invasion, Body Swap, Heist, Revenge Plot, Monster Attack, Hidden World. Target 5-10.

Uniqueness: Must be concrete plot/world elements. NO abstract themes (e.g., no 'Love'), moods (e.g., no 'Suspense'), or genre labels. Be specific (e.g., 'Zombie Outbreak' not 'Conflict').

narrative_dna.themes:Role: Identify the central abstract ideas, concepts, questions, or messages explored.

Content: Conceptual nouns/phrases. Redemption, Nature vs Nurture, Cost of Ambition, Loss of Innocence, Social Class Commentary, Identity Crisis, Forbidden Love. Target 3-5 core themes.

Uniqueness: Must be abstract concepts. NO plot points, character types, or feelings.

narrative_dna.narrative_structures:Role: Identify the framework of the storytelling.

Content: Linear Narrative, Nonlinear Narrative, Multiple Perspectives, Framed Story, Episodic Structure, Hero's Journey, Real-Time Narrative, Found Footage. Target 1-3.

narrative_dna.character_archetypes:Role: Identify core character models or roles (beyond specific plot functions).

Content: Anti-Hero, Mentor, Femme Fatale, Underdog, Trickster, Reluctant Hero, Sidekick, Wise Old Man/Woman. Target 1-4. Avoid generic terms like 'Protagonist'.

dimensional_scores:(Insert the FULL definitions for all 25 scores from Prompt 3 here, including the 1-10 scale description)

Example (pacing): pacing: 1 (Extremely Slow/Meditative) <--> 5/6 (Moderate Momentum) <--> 10 (Frantic/Relentless). Focus: Speed of plot advancement and scene transitions.

Example (character_depth): character_depth: 1 (Archetypal/Static/Plot Devices) <--> 5/6 (Developed Characters, Some Growth) <--> 10 (Nuanced/Multi-layered/Significant Evolution). Focus: Depth, complexity, and development of primary characters.

(Continue for all 25 scores)

aesthetic_sensory.dominant_moods:Role: Describe the prevailing emotional atmosphere or feeling evoked.

Content: Evocative adjectives. Suspenseful, Nostalgic, Bleak, Whimsical, Tense, Melancholic, Romantic, Ominous, Joyful, Serene, Anxious, Surreal, Dreamlike, Energetic. Target 2-4 distinct core moods.

Uniqueness: Describes the feeling. Do NOT use genre labels (e.g., 'Horror Mood'), humor styles (e.g., 'Comedic Mood'), or plot descriptors (e.g., 'Action Mood'). If the genre is Film Noir, the mood might be Bleak, Cynical, or Fatalistic, not just Noir.

aesthetic_sensory.humor_styles:Role: Identify specific techniques or types of comedy used. (Assign only if humor is present).

Content: Satire, Slapstick, Witty Banter, Dark Comedy, Observational Humor, Physical Comedy, Parody, Irony, Absurdist Humor, Wordplay, Running Gags. Target 1-5 styles if applicable.

Uniqueness: Describes the how of the humor. Distinct from the overall humor_level score and dominant_moods.

aesthetic_sensory.visual_styles_techniques:Role: Describe specific, noticeable visual elements or filmmaking techniques.

Content: Film Noir Aesthetics, Handheld Camera Work, Vibrant Color Palette, Long Takes, High Contrast Lighting, Surreal Imagery, Minimalist Design, Black and White Cinematography, Slow Motion. Target 3-7.

aesthetic_sensory.auditory_styles_elements:Role: Describe specific, noticeable elements of the score or sound design.

Content: Orchestral Score, Electronic Music, Minimalist Soundtrack, Use of Silence, Sound Effects Emphasis, Diegetic Music Focus, Jazz Score, Leitmotifs. Target 2-5.

aesthetic_sensory.dialogue_styles:Role: Describe the manner or style of the spoken dialogue.

Content: Witty Banter, Formal Dialogue, Slang-Heavy, Monologues, Fast-Paced Exchanges, Poetic Language, Minimalist Dialogue, Technical Jargon. Target 1-3.

aesthetic_sensory.costume_set_design_styles:Role: Describe the aesthetic approach to costumes and sets.

Content: Period-Accurate Costumes, Futuristic Sets, Minimalist Design, Extravagant Wardrobes, Gritty Urban Sets, Fantasy Costumes, Gothic Architecture, Steampunk Elements. Target 2-5.

content_advisories.specific_warnings:Role: List specific content elements that might warrant warning, potentially adding nuance beyond the dimensional_scores.

Content: Use specific terms if applicable. Graphic Violence, Sexual Content, Strong Language, Drug Use, Nudity, Mature Themes, Gore, Disturbing Images, Animal Harm, Self-Harm Themes, Abuse Depiction, Smoking. Assign as needed, be specific.

impact_context.cultural_impact_markers:Role: Identify indicators of the work's influence or reception.

Content: Iconic Catchphrase, Influenced a Genre, Parodied Frequently, Major Award Winner (Specify e.g., Oscar Best Picture), Cult Classic Status, Launched Franchise, Memorable Soundtrack, Pioneering Special Effects. Assign as needed.

impact_context.relevant_movements_styles:Role: Connect the work to broader cinematic or artistic movements/styles.

Content: French New Wave, Italian Neorealism, Mumblecore, Dogme 95, Cinema Verite, Blaxploitation. Assign as needed.

Final Check:
* Ensure the output is a single, valid JSON object. No markdown syntax wrapping the json is allowed.
* Verify that all requested fields are present and populated according to the guidelines.
* Double-check that the Radical Uniqueness Principle has been applied, minimizing semantic overlap between attributes.
* Confirm all 25 dimensional_scores are assigned an integer between 1 and 10.
"""

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
def _run_llm_generation(llm: Llama, user_prompt: str, max_tokens: int): # Pass user_prompt directly
    """Synchronous function containing the blocking llama.cpp call using chat completion."""
    try:
        # Construct messages list including the system prompt
        messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        logger.debug(f"Starting llama.cpp chat completion with max_tokens={max_tokens}, system prompt added.")
        completion = llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            top_k=50,
            stop=["<end_of_turn>", "<eos>"],
            # repetition_penalty=1.1 # Add if needed
        )
        logger.debug("llama.cpp chat completion finished.")

        if completion and 'choices' in completion and len(completion['choices']) > 0:
             content = completion['choices'][0].get('message', {}).get('content')
             return content.strip() if content else ""
        else:
             logger.warning("LLM completion did not return expected structure.")
             return ""
    except Exception as e:
        logger.error(f"Error during underlying llama.cpp generation: {e}", exc_info=True)
        raise e

async def generate_text(prompt: str, max_new_tokens: int) -> str:
    """
    Generates text using the loaded GGUF LLM via llama-cpp-python,
    running the blocking call in FastAPI/Starlette's thread pool.
    System prompt is added internally.
    """
    try:
        llm = get_llm() # Will raise 503 if LLM not loaded

        # The system prompt is now handled inside _run_llm_generation
        # We only need the user prompt here.

        logger.info(f"Dispatching llama.cpp generation task to thread pool (max_tokens={max_new_tokens})...")
        result = await run_in_threadpool(
            _run_llm_generation,
            llm=llm,
            user_prompt=prompt, # Pass only the user prompt now
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

        max_tokens = min(input_data.max_new_tokens, MAX_OUTPUT_TOKENS * 1.5) # Cap flexibility
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