from f.data_source.common import get_documents_for_ids, IdParameter
from f.db.mongodb import init_mongodb, close_mongodb
from f.dna.models import DnaMovie, DnaTv


DNA_CHUNK_SIZE = 5


def main(next_ids: dict):
    init_mongodb()
    next_entries = get_documents_for_ids(
        next_ids=next_ids,
        movie_model=DnaMovie,
        tv_model=DnaTv,
    )

    entries_to_fetch = []
    for next_entry in next_entries:
        if isinstance(next_entry, DnaMovie):
            id_type = "movie"
        elif isinstance(next_entry, DnaTv):
            id_type = "tv"
        else:
            raise Exception(f"next_entry has an unexpected type: {type(next_entry)}")

        entries_to_fetch.append(
            IdParameter(
                id=str(next_entry.id),
                tmdb_id=next_entry.tmdb_id,
                type=id_type,
            ).model_dump()
        )

    close_mongodb()
    
    chunked_list = [
        entries_to_fetch[i : i + DNA_CHUNK_SIZE]
        for i in range(0, len(entries_to_fetch), DNA_CHUNK_SIZE)
    ]

    return chunked_list
