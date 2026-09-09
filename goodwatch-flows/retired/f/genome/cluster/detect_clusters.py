import ast
import numpy as np
import pandas as pd
from collections import defaultdict
from typing import Dict, Set

from f.db.postgres import init_postgres


class MemoryEfficientTagClusterer:
    def __init__(
        self,
        connection,
        distance_threshold: float = 0.15,
        processing_batch_size: int = 1000,
        db_batch_size: int = 5000,
    ):
        self.connection = connection
        self.distance_threshold = distance_threshold
        self.processing_batch_size = processing_batch_size
        self.db_batch_size = db_batch_size
        self.tag_clusters = defaultdict(set)
        self.tag_data = {}

    def fetch_tags(self, last_id: int = 0) -> pd.DataFrame:
        """Fetch a batch of tag data from the database."""
        query = """
        SELECT id, category, label, label_vector_v2, count_all
        FROM dna
        WHERE id > %(last_id)s
        ORDER BY id
        LIMIT %(batch_size)s
        """
        params = {"last_id": last_id, "batch_size": self.db_batch_size}
        return pd.read_sql_query(query, self.connection, params=params)

    def process_all_tags(self) -> Dict[str, Set[str]]:
        """
        Process all tags from the database in batches.
        Returns the final clustered tags.
        """
        last_id = 0
        current_batch = pd.DataFrame()
        total_processed = 0

        while True:
            batch = self.fetch_tags(last_id)
            if batch.empty:
                break

            # Update last_id for next iteration
            last_id = int(batch["id"].max())

            # Parse the string vectors into actual lists
            batch["label_vector_v2"] = batch["label_vector_v2"].apply(ast.literal_eval)

            # Add to current batch
            current_batch = pd.concat([current_batch, batch])

            # Store metadata (keyed by 'id')
            self.tag_data.update(
                batch.set_index("id")[["label", "category", "count_all"]].to_dict("index")
            )

            # When we have enough tags, process them
            if len(current_batch) >= self.processing_batch_size:
                self._process_batch(current_batch)
                total_processed += len(current_batch)
                print(f"Processed {total_processed} tags...")
                current_batch = pd.DataFrame()

        # Process any remaining tags
        if not current_batch.empty:
            self._process_batch(current_batch)
            total_processed += len(current_batch)
            print(f"Processed {total_processed} tags (final batch)")

        # Merge overlapping clusters
        return self.merge_overlapping_clusters()

    def _process_batch(self, batch: pd.DataFrame):
        """Process a batch of tags to find similar pairs."""
        # Convert embeddings to numpy array
        embeddings = np.vstack(batch["label_vector_v2"].values).astype(np.float64)
        labels = batch["label"].values

        # Add debug info for first batch
        if not hasattr(self, "_printed_debug"):
            print(f"Embeddings shape: {embeddings.shape}")
            print(f"Embeddings dtype: {embeddings.dtype}")
            print(f"First embedding sample: {embeddings[0][:5]}...")
            self._printed_debug = True

        # Calculate pairwise distances within batch
        for i in range(len(batch)):
            for j in range(i + 1, len(batch)):
                # Cosine distance
                distance = 1 - np.dot(embeddings[i], embeddings[j]) / (
                    np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j])
                )

                if distance <= self.distance_threshold:
                    self.tag_clusters[labels[i]].add(labels[j])
                    self.tag_clusters[labels[j]].add(labels[i])

    def merge_overlapping_clusters(self, overlap_threshold: float = 0.5) -> Dict[str, Set[str]]:
        """
        Merge clusters that have significant overlap.
        Uses tag count (popularity) as one factor in choosing representative tags.
        """
        merged_clusters = {}
        processed_tags = set()

        # Sort tags by their cluster size and count
        tags_by_importance = sorted(
            self.tag_clusters.keys(),
            key=lambda x: (len(self.tag_clusters[x]), self.tag_data[x]["count_all"]),
            reverse=True,
        )

        for tag in tags_by_importance:
            if tag in processed_tags:
                continue

            current_cluster = self.tag_clusters[tag]
            if not current_cluster:
                continue

            # Find all related clusters with significant overlap
            related_clusters = []
            for other_tag in current_cluster:
                other_cluster = self.tag_clusters[other_tag]
                overlap = len(current_cluster & other_cluster)
                smaller_cluster_size = min(len(current_cluster), len(other_cluster))

                if overlap / smaller_cluster_size >= overlap_threshold:
                    related_clusters.append(other_cluster)
                    processed_tags.add(other_tag)

            # Merge related clusters
            merged_cluster = current_cluster.union(*related_clusters)

            # Choose representative tag based on popularity (count_all) and label length
            representative = max(
                merged_cluster, key=lambda x: (self.tag_data[x]["count_all"], -len(x))
            )
            merged_clusters[representative] = merged_cluster - {representative}

            processed_tags.add(tag)

        return merged_clusters


def main():
    """
    Main entry point for the clustering pipeline.
    """
    pg = init_postgres()
    try:
        clusterer = MemoryEfficientTagClusterer(
            connection=pg,
            distance_threshold=0.15,
            processing_batch_size=1000,
            db_batch_size=5000,
        )
        clusters = clusterer.process_all_tags()
    finally:
        pg.close()
    return clusters
