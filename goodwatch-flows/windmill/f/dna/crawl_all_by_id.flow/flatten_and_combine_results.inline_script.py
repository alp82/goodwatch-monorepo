def main(next_ids: dict, results: list[list[dict]]) -> list[dict]:
    movie_ids = next_ids.get("movie_ids", [])
    tv_ids = next_ids.get("tv_ids", [])
    all_ids = movie_ids + tv_ids

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
            flattened_results.append(result)

    if len(all_ids) != len(flattened_results):
        raise ValueError(
            f"Mismatch in lengths. IDs: {len(all_ids)}, "
            f"Results: {len(flattened_results)}"
        )

    combined_results = [
        {"id": id, "dna": result}
        for id, result in zip(all_ids, flattened_results)
    ]
    return combined_results
