from f.data_source.common import IdsParameter
from f.db.mongodb import init_mongodb, close_mongodb


BATCH_SIZE = 10
BUFFER_SELECTED_AT_MINUTES = 30


def main():
    init_mongodb()
    # https://goodwatch.app/movie/1051896-arcadian
    ids = IdsParameter(
        movie_ids=["651f3f5a75335406a225c964"],
        tv_ids=[],
    )
    close_mongodb()
    return ids.model_dump()


if __name__ == "__main__":
    main()
