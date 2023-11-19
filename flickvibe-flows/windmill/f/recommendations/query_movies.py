# requirements:
# weaviate-client>=4.2b0
# wmill

import weaviate
from weaviate.util import generate_uuid5
import wmill

WeaviateServer = wmill.get_resource("u/Alp/weaviate_server")


def main(tmdb_ids: list[str] = [13, 122, 129, 155, 278, 424, 550, 603, 680]):
    print("connecting to weaviate server...")
    weaviate_client = weaviate.connect_to_local(
        host=WeaviateServer.get("host"),
        port=WeaviateServer.get("port"),
        grpc_port=WeaviateServer.get("grpc_port"),
        headers=WeaviateServer.get("headers"),
    )

    collection_name = "Movie"
    movie_collection = weaviate_client.collections.get(collection_name)

    outputs = []
    for tmdb_id in tmdb_ids:
        response = movie_collection.query.near_object(
            near_object=generate_uuid5(tmdb_id),
            limit=6,
        )
        movie_source = f"{response.objects[0].properties['original_title']} ({int(response.objects[0].properties.get('release_year'))})"
        recommendations = [
            f"{recommendation.properties['original_title']} ({int(recommendation.properties.get('release_year'))})"
            for recommendation in response.objects[1:]
        ]
        output = f"TOP5 for {movie_source}: {', '.join(recommendations)}"
        outputs.append(output)
        print(output)

    return outputs
