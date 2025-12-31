def main(next_ids: dict, results: list[list[dict]]) -> list[dict]:
    movie_ids = next_ids.get("movie_ids", [])
    tv_ids = next_ids.get("tv_ids", [])
    all_ids = movie_ids + tv_ids

    flattened_results = [item for sublist in results for item in sublist]

    if len(all_ids) != len(flattened_results):
        raise Exception(f"Warning: Mismatch in lengths. IDs: {len(all_ids)}, Results: {len(flattened_results)}")

    combined_results = [
        {"id": id, "dna": result}
        for id, result in zip(all_ids, flattened_results)
    ]
    return combined_results
