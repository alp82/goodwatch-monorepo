def main(next_ids: dict, results: list[list[dict]]) -> list[dict]:
    movie_ids = next_ids.get("movie_ids", [])
    tv_ids = next_ids.get("tv_ids", [])
    all_ids = set(movie_ids + tv_ids)
    seen_ids = set()

    flattened_results = []
    for batch_index, batch in enumerate(results):
        if not isinstance(batch, list):
            raise ValueError(
                f"results[{batch_index}] must be a list; got {type(batch).__name__}. "
                "The DNA generation loop may have returned a failed iteration."
            )

        for result_index, result in enumerate(batch):
            if not isinstance(result, dict):
                raise ValueError(
                    f"results[{batch_index}][{result_index}] must be an object; "
                    f"got {type(result).__name__}"
                )
            result_id = result.get("id")
            if not isinstance(result_id, str) or result_id not in all_ids or result_id in seen_ids:
                raise ValueError(f"Unexpected or duplicate result ID: {result_id}")
            if not isinstance(result.get("dna"), dict):
                raise ValueError(f"results[{batch_index}][{result_index}].dna must be an object")
            seen_ids.add(result_id)
            flattened_results.append(result)

    return flattened_results
