# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Install git (required for some models)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Download the model and tokenizer
RUN python -c "from sentence_transformers import SentenceTransformer; \
               model = SentenceTransformer('jinaai/jina-embeddings-v2-small-en')"

# Copy the application code
COPY . /app/

# Expose the port FastAPI is running on
EXPOSE 80

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "80"]
