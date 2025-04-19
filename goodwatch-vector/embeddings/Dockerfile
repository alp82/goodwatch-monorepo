# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/app/.cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers
# For llama-cpp-python build
ENV CMAKE_ARGS="-DLLAMA_CUBLAS=OFF -DLLAMA_METAL=OFF -DLLAMA_HIPBLAS=OFF -DLLAMA_OPENBLAS=OFF"
ENV FORCE_CMAKE=1

# Install git, build tools (cmake needed for llama-cpp-python)
RUN apt-get update && apt-get install -y git build-essential cmake && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
# Ensure requirements.txt includes: llama-cpp-python>=0.2.70 huggingface-hub etc.
# REMOVE ctransformers
COPY requirements.txt /app/
# Note: llama-cpp-python install might take time as it compiles bindings
RUN pip install --no-cache-dir -r requirements.txt

# --- Preload models using script ---

# Declare build arguments that will receive values from docker-compose.yml build.args
ARG HUGGING_FACE_HUB_TOKEN
ARG EMBEDDING_MODEL_NAME
ARG LLM_MODEL_REPO_ID
ARG LLM_MODEL_FILENAME

# Set ENV vars FROM the ARGs passed during build. Needed for preload script.
ENV HUGGING_FACE_HUB_TOKEN=${HUGGING_FACE_HUB_TOKEN}
ENV EMBEDDING_MODEL_NAME=${EMBEDDING_MODEL_NAME}
ENV LLM_MODEL_REPO_ID=${LLM_MODEL_REPO_ID}
ENV LLM_MODEL_FILENAME=${LLM_MODEL_FILENAME}

# Copy and run the preload script (using the updated llama-cpp-python logic)
COPY preload_models.py /app/
# This will download the GGUF and verify loading with Llama()
RUN python /app/preload_models.py

# Optional: Remove script after running
# RUN rm /app/preload_models.py

# Copy the main application code AFTER dependencies and preloading
COPY server.py /app/

# Expose the port FastAPI is running on
EXPOSE 80

# Run the application using Uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "80", "--workers", "1"]