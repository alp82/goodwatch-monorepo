from f.db.arango import ArangoConnector
from f.main_db.config.graph import COLLECTIONS, INDEX_DEFINITIONS, EDGES, VIEW_GLOBAL_SEARCH_PARAMS


def main(graph_name = "goodwatch", DELETE_ALL = False):
    connector = ArangoConnector()

    # WARNING: this removes all of the arango db including data
    if DELETE_ALL:
        connector.delete_all_collections_and_graphs()

    for collection_name in COLLECTIONS.values():
        connector.ensure_collection(collection_name)

    edge_defs = []
    for edge in EDGES.values():
        connector.ensure_collection(edge["name"], edge=True)
        edge_defs.append({
            'edge_collection': edge["name"],
            'from_vertex_collections': edge["from"],
            'to_vertex_collections': edge["to"],
        })

    connector.ensure_graph(graph_name, EDGES.values())

    for collection_name, index_list in INDEX_DEFINITIONS.items():
        for index_def in index_list:
            connector.ensure_index(collection_name, index_def)

    connector.ensure_view("global_search", VIEW_GLOBAL_SEARCH_PARAMS)

    connector.close()
    print(f"Schema setup complete for graph '{graph_name}'")
