from math import floor
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_distances
import hdbscan

from f.db.postgres import init_postgres

# Parameters
FULL_SIZE = 320000
BATCH_SIZE = 5000
STOP_AFTER = 400000  # Stop after processing this many items (debugging/early stopping)

PCA_COMPONENTS = 200  # Should lead to explained_variance_ratio >= 0.95
EMBEDDINGS_MAX_DISTANCE = 0.15
HDBSCAN_MIN_CLUSTER_SIZE = 2
HDBSCAN_MIN_SAMPLES = floor(FULL_SIZE * 0.01)  # Encourage cluster formation
CLUSTER_SUMMARY_SAMPLE_SIZE = 10


# Fetch a batch of DNA data
def fetch_dna_data(pg, last_id, batch_size):
    """
    Fetch a batch of DNA data from the database.
    """
    print(f"Fetching DNA data from database... (last_id: {last_id})")
    fetch_dna_sql = """
    SELECT id, category, label, label_vector_v2, count_all
    FROM dna
    WHERE id > %(last_id)s
    ORDER BY id
    LIMIT %(batch_size)s
    """
    params = {"last_id": last_id, "batch_size": batch_size}
    return pd.read_sql_query(fetch_dna_sql, pg, params=params)


# Reduce dimensionality using PCA
def reduce_dimensions(embeddings, n_components):
    """
    Reduce dimensionality of embeddings using PCA.
    """
    print(f"Reducing dimensions from {embeddings.shape[1]} to {n_components}...")
    pca = PCA(n_components=n_components, random_state=42)
    reduced_embeddings = pca.fit_transform(embeddings)
    print(f"Explained variance ratio: {sum(pca.explained_variance_ratio_):.2f}")
    return reduced_embeddings


# Perform clustering using HDBSCAN
def cluster_embeddings_with_cosine(embeddings, max_distance=0.2, min_samples=5):
    """
    Perform clustering using HDBSCAN with a max cosine distance threshold.
    """
    print("Computing cosine distance matrix...")
    distance_matrix = cosine_distances(embeddings).astype("float64")

    print(f"Clustering with HDBSCAN (max cosine distance = {max_distance})...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE,
        min_samples=min_samples,
        metric="precomputed",
        cluster_selection_epsilon=max_distance,
        core_dist_n_jobs=-1,
    )
    cluster_labels = clusterer.fit_predict(distance_matrix)

    num_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    print(f"Number of clusters found: {num_clusters}")
    return cluster_labels


# Update global clusters
def update_global_clusters(global_clusters, embeddings, labels, ids, cluster_labels, max_distance):
    """
    Efficiently update global clusters using centroid-based matching and representative samples.
    """
    for cluster_id in set(cluster_labels):
        if cluster_id == -1:  # Skip noise points
            continue

        cluster_points = embeddings[cluster_labels == cluster_id]
        cluster_labels_text = labels[cluster_labels == cluster_id]
        cluster_ids = ids[cluster_labels == cluster_id]
        cluster_centroid = np.mean(cluster_points, axis=0)

        # Match to an existing global cluster using centroid distance
        matched_global_cluster = None
        for global_id, cluster_data in global_clusters.items():
            global_centroid = cluster_data["centroid"]
            if np.linalg.norm(global_centroid - cluster_centroid) < max_distance:
                matched_global_cluster = global_id
                break

        if matched_global_cluster is not None:
            # Update existing global cluster
            global_clusters[matched_global_cluster]["members"].extend(cluster_points[:10])  # Limit size
            global_clusters[matched_global_cluster]["labels"].extend(cluster_labels_text[:10])
            global_clusters[matched_global_cluster]["ids"].extend(cluster_ids[:10])
            global_clusters[matched_global_cluster]["centroid"] = np.mean(
                global_clusters[matched_global_cluster]["members"], axis=0
            )
        else:
            # Create a new global cluster for this batch cluster
            new_id = len(global_clusters)
            global_clusters[new_id] = {
                "centroid": cluster_centroid,
                "members": list(cluster_points),
                "labels": list(cluster_labels_text),
                "ids": list(cluster_ids),
            }

    return global_clusters



# Generate cluster summary
def generate_cluster_summary(global_clusters):
    """
    Create a DataFrame summarizing clusters with representative labels and IDs.
    """
    print("Generating cluster summary...")
    cluster_data = []
    for cluster_id, cluster_info in global_clusters.items():
        cluster_data.append(
            {
                "Cluster ID": cluster_id,
                "Number of Points": len(cluster_info["labels"]),
                "Sample IDs": cluster_info.get("ids", [])[:CLUSTER_SUMMARY_SAMPLE_SIZE],
                "Sample Labels": cluster_info["labels"][:CLUSTER_SUMMARY_SAMPLE_SIZE],
            }
        )

    # Create and sort DataFrame by cluster size (biggest first)
    cluster_df = pd.DataFrame(cluster_data)
    cluster_df = cluster_df.sort_values(
        by="Number of Points", ascending=False
    ).reset_index(drop=True)
    return cluster_df


# Main clustering logic
def detect_clusters(pg):
    """
    Detect clusters incrementally in batches and update global state.
    """
    last_id = 0
    processed_items = 0
    global_clusters = {}

    while processed_items < STOP_AFTER:
        batch_df = fetch_dna_data(pg, last_id, BATCH_SIZE)
        if batch_df.empty:
            print("No more data to process.")
            break

        # Prepare embeddings, labels, and IDs
        embeddings = np.vstack(batch_df["label_vector_v2"].apply(eval).values).astype(
            "float32"
        )
        labels = batch_df["label"].values
        ids = batch_df["id"].values
        embeddings_reduced = reduce_dimensions(embeddings, PCA_COMPONENTS)

        # Cluster the batch
        cluster_labels = cluster_embeddings_with_cosine(
            embeddings_reduced,
            max_distance=EMBEDDINGS_MAX_DISTANCE,
            min_samples=HDBSCAN_MIN_SAMPLES,
        )

        # Update global clusters with labels and IDs
        global_clusters = update_global_clusters(
            global_clusters,
            embeddings_reduced,
            labels,
            ids,
            cluster_labels,
            EMBEDDINGS_MAX_DISTANCE,
        )

        # Update processed items and last ID
        processed_items += len(batch_df)
        last_id = int(batch_df["id"].max())

        print(f"Processed {processed_items} items so far...")

    # Generate cluster summary as DataFrame
    cluster_summary_df = generate_cluster_summary(global_clusters)
    return cluster_summary_df


def main():
    """
    Main entry point for the clustering pipeline.
    """
    pg = init_postgres()
    try:
        cluster_summary_df = detect_clusters(pg)
        print(cluster_summary_df)
    finally:
        pg.close()
    return cluster_summary_df
