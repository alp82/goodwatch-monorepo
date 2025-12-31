#requirements:
#google-genai
#mongoengine
#wmill
from datetime import datetime
from typing import Union

from google import genai
from google.genai import types
import wmill

from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import CoreScores, DnaMovie, DnaTv

# model names: https://ai.google.dev/gemini-api/docs/embeddings#embeddings-models
# rate limits: https://ai.google.dev/gemini-api/docs/models#text-embedding-and-embedding
#  * 1,500 requests per minute
#  * 2,048 tokens per input
model = "text-embedding-004"            # supports: 768
#model = "gemini-embedding-exp-03-07"    # supports: 3072, 1536 or 768

dimensionality = 768
max_inputs = 100


def generate_vectors(results: list[dict]):
    api_key = wmill.get_variable("u/Alp/GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
    )

    inputs = [result["dna"]["essence_text"] for result in results]
    response = client.models.embed_content(
        model=model,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=dimensionality,
        ),
        contents=inputs,
    )
    embeddings = [embedding.values for embedding in response.embeddings]

    print(f"Successfully generated {len(embeddings)} embeddings.\n")
    return embeddings


def create_embedding_from_scores(data: dict) -> list[float]:
    scores = CoreScores(**data)
    ordered_field_names = list(scores.model_fields.keys())

    embedding = []
    for field_name in ordered_field_names:
        value = getattr(scores, field_name)
        embedding.append(float(value))
        
    return embedding


def store_result(next_entry: Union[DnaMovie, DnaTv], vector_essence_text: list[float], vector_fingerprint: list[float]):
    print(f"saving DNA for {next_entry.original_title} ({next_entry.release_year})")

    next_entry.vector_essence_text = vector_essence_text
    next_entry.vector_fingerprint = vector_fingerprint
    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    next_entry.save()
    

def main(ids: dict[str, list], results: list[dict]):
    embeddings = generate_vectors(results)

    init_mongodb()
    for index, result in enumerate(results):
        result_id = result["id"]
        embedding = embeddings[index]

        collection_class = DnaMovie if result_id in ids["movie_ids"] else DnaTv
        next_entry = collection_class.objects.get(id=result_id)
        fingerprint = create_embedding_from_scores(next_entry.dna["fingerprint"]["scores"])

        store_result(next_entry, embedding, fingerprint)
        print(fingerprint)
    close_mongodb()

    return {
        "embeddings_count": len(embeddings),
    }
