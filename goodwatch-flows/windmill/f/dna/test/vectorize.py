#requirements:
#google-genai
#numpy
#wmill

from google import genai
from google.genai import types
import numpy as np
import wmill

# model names: https://ai.google.dev/gemini-api/docs/embeddings#embeddings-models
# rate limits: https://ai.google.dev/gemini-api/docs/models#text-embedding-and-embedding
#  * 1,500 requests per minute
#  * 2,048 tokens per input
#  * ? requests per day
model = "gemini-embedding-001"           # supports: 768
#model = "gemini-embedding-exp-03-07"    # supports: 3072, 1536 or 768

dimensionality = 768
max_inputs = 100


def cosine_similarity(vec1, vec2):
    """Calculates the cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    
    dot_product = np.dot(vec1, vec2)
    norm_vec1 = np.linalg.norm(vec1)
    norm_vec2 = np.linalg.norm(vec2)
    
    if norm_vec1 == 0 or norm_vec2 == 0:
        return 0
    
    similarity = dot_product / (norm_vec1 * norm_vec2)
    return similarity
    

def cosine_distance(vec1, vec2):
    """Calculates the cosine distance between two vectors."""
    return 1 - cosine_similarity(vec1, vec2)


def main(inputs: list[str] = [
    "A revolutionary cyberpunk action film that seamlessly blends philosophical depth with thrilling martial arts choreography and groundbreaking visual effects. It immerses viewers in a stylized, dystopian future, questioning the nature of reality and consciousness. The film's enduring impact comes from its blend of intense action sequences, compelling narrative, and profound thematic exploration. This is an essential watch for those seeking a highly original and thought-provoking cinematic experience.",    
    "A high-octane sci-fi action spectacle that delves deeper into the philosophical and mythological labyrinth of the Matrix universe. It's a relentless surge of adrenaline and tension, featuring groundbreaking visual effects and intricate action choreography. While expanding on the saga's grand themes, the film largely prioritizes kinetic energy and epic scale. This entry serves as a crucial, intense bridge to the concluding chapter, packed with iconic sequences.",
    "An essential collection of animated shorts that profoundly deepens the lore and philosophical underpinnings of The Matrix universe. Each segment offers a unique visual style and narrative perspective, showcasing the versatility of anime in exploring complex sci-fi themes. From the origins of the machine war to individual awakenings, it provides crucial background and expands on the saga's existential questions. This anthology is a visually stunning and intellectually stimulating companion piece.",
    "A breathtaking and utterly relentless action epic that pushes the boundaries of cinematic combat. It's a masterclass in stylized violence and kinetic energy, delivering non-stop, exquisitely choreographed set pieces across stunning global backdrops. The film is a sensory overload, designed for pure adrenaline and spectacle, firmly cementing its place as a benchmark for modern action cinema. While light on plot, its unwavering commitment to explosive, impeccably staged sequences makes it a thrilling, visceral experience.",
    "A delightfully chaotic and laugh-out-loud animated comedy that perfectly captures the irreverent spirit of its beloved television predecessor. The film delivers sharp social commentary through its signature blend of slapstick and witty dialogue, making it accessible for a wide audience. It balances its signature humor with a surprising amount of heart and even a relevant environmental message. This movie offers pure comfort viewing, packed with memorable gags and rewatchable moments for fans of all ages.",
    "A taut and psychologically intense drama exploring the dangerous consequences of a forbidden affair. The film delves deeply into the complex desires and moral ambiguities of its characters, fueled by a palpable erotic tension. It's a grounded, character-driven piece that explores themes of power, risk, and the destructive nature of secrets within a contemporary setting. This movie is a provocative and unsettling experience best suited for an adult audience seeking a nuanced look at human relationships.",
    "A sprawling, politically charged epic fantasy that plunges viewers into a brutal world of warring houses and ancient threats. Its narrative is defined by intricate plotting, morally ambiguous characters, and sudden, shocking turns of fate. The series delivers a visceral blend of high drama, grand spectacle, and devastating emotional impact, making it an intensely immersive and often challenging viewing experience. It explores themes of power, ambition, and survival within a richly detailed, unforgiving universe.",
    "A groundbreaking space opera that masterfully weaves a complex, five-year narrative arc of interstellar politics, war, and prophecy. It distinguishes itself with deeply developed characters and profound philosophical inquiries into conflict, cooperation, and the nature of power. The series thrives on its intricate world-building and a strong emphasis on dialogue, making it a cerebral and emotionally resonant journey through a richly imagined future. It offers a unique and influential take on the science fiction genre.",
    "A groundbreaking and intensely gripping crime drama that meticulously chronicles the tragic transformation of an ordinary man into a ruthless criminal mastermind. The series is a masterclass in tension, character development, and intricate plotting, constantly ratcheting up the stakes with each episode. Its bleak yet darkly humorous tone, combined with unparalleled performances and cinematic direction, creates an immersive and unforgettable viewing experience about the corrosive nature of power and ambition. This show demands full attention and offers profound insights into human morality.",
], query: str = "scifi action"):
    api_key = wmill.get_variable("u/Alp/GEMINI_API_KEY")
    client = genai.Client(
        api_key=api_key,
    )

    print("List of models that support embedContent:\n")
    for m in client.models.list():
        for action in m.supported_actions:
            if action == "embedContent":
                print(m.name)
    
    response = client.models.embed_content(
        model=model,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            #task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=dimensionality,
        ),
        contents=inputs,
    )
    embeddings = [embedding.values for embedding in response.embeddings]

    print(f"Successfully generated {len(embeddings)} embeddings.\n")

    # Calculate and print cosine distances
    print("Cosine Distances between document embeddings:\n")
    num_embeddings = len(embeddings)
    if num_embeddings < 2:
        print("Need at least two embeddings to calculate distances.")

    for i in range(num_embeddings):
        for j in range(i + 1, num_embeddings): # Iterate to avoid redundant pairs and self-comparison
            dist = cosine_distance(embeddings[i], embeddings[j])
            print(f"Distance between Input {i+1} and Input {j+1}: {dist:.4f}")

    # Generate embedding for query
    query_response = client.models.embed_content(
        model=model,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            #task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=dimensionality,
        ),
        contents=[query],
    )
    query_embedding = query_response.embeddings[0].values
    
    print(f"Successfully generated query embedding for: '{query}'\n")

    # Calculate similarities between query and each document
    similarities = []
    for i, embedding in enumerate(embeddings):
        similarity = cosine_similarity(query_embedding, embedding)
        similarities.append((i, similarity, inputs[i]))
    
    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # Print results
    print(f"Documents ranked by similarity to query '{query}':\n")
    print("-" * 80)
    for rank, (idx, similarity, doc) in enumerate(similarities, 1):
        print(f"Rank {rank}: Document {idx + 1} (Similarity: {similarity:.4f})")
        # Print first 150 characters of the document for context
        doc_preview = doc[:150] + "..." if len(doc) > 150 else doc
        print(f"Preview: {doc_preview}")
        print("-" * 80)
        
    return {
        "embeddings": embeddings,
        "query_embedding": query_embedding,
        "ranked_results": [(idx, sim) for idx, sim, _ in similarities]
    }
