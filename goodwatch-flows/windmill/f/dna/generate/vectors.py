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

# Model details: https://ai.google.dev/gemini-api/docs/embeddings#model_versions
model = "gemini-embedding-2"

dimensionality = 768
max_inputs = 100


def get_embedding_inputs(results: list[dict]) -> list[str]:
    if not isinstance(results, list):
        raise ValueError(f"results must be a list; got {type(results).__name__}")

    inputs = []
    for index, result in enumerate(results):
        if not isinstance(result, dict):
            raise ValueError(
                f"results[{index}] must be an object; got {type(result).__name__}"
            )

        dna = result.get("dna")
        if not isinstance(dna, dict):
            raise ValueError(
                f"results[{index}].dna must be an object; got {type(dna).__name__}"
            )

        essence_text = dna.get("essence_text")
        if not isinstance(essence_text, str):
            raise ValueError(
                f"results[{index}].dna.essence_text must be a string; "
                f"got {type(essence_text).__name__}"
            )
        inputs.append(essence_text)

    return inputs


def generate_vectors(results: list[dict]):
    inputs = get_embedding_inputs(results)
    api_key = wmill.get_variable("u/Alp/GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
    )

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
