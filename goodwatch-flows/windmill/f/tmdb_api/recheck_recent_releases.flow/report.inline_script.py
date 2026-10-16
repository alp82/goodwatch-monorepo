def main(plan: dict, batches: list):
    # A loop with skip_failures returns error results for exhausted iterations.
    successful = [batch for batch in batches if isinstance(batch, dict) and "error" not in batch]
    failed_iterations = len(batches) - len(successful)
    totals = {key: sum(batch.get(key, 0) for batch in successful)
              for key in ("count_new_entries", "count_failed_entries", "count_deleted_entries")}
    if failed_iterations or totals["count_failed_entries"]:
        raise RuntimeError(
            f"Recent release recheck failed iterations: {failed_iterations}, "
            f"failed titles: {totals['count_failed_entries']}; {totals}; rerun to retry"
        )
    return {key: value for key, value in plan.items() if key not in ("titles", "batches")} | totals | {
        "failed_iterations": failed_iterations,
    }
