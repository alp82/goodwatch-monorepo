from f.data_source.common import IdsParameter
from f.db.mongodb import init_mongodb


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 30


def main():
    init_mongodb()
    ids = IdsParameter(
        movie_ids=[872585],
        tv_ids=[],
    )
    return ids.model_dump()


if __name__ == "__main__":
    main()
