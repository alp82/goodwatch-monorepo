from mongoengine import connect, disconnect
import wmill


CONNECTION_ALIAS = "default"
MAX_IDLE_TIME_MS = 60000


def init_mongodb():
    print(f"Initializing mongodb...")
    db_name = wmill.get_variable("u/Alp/MONGODB_DB")
    db_host = wmill.get_variable("u/Alp/MONGODB_HOST")
    db_port = int(wmill.get_variable("u/Alp/MONGODB_PORT"))
    db_user = wmill.get_variable("u/Alp/MONGODB_USER")
    db_pass = wmill.get_variable("u/Alp/MONGODB_PASS")
    try:
        connect(
            db=db_name,
            host=db_host,
            port=db_port,
            username=db_user,
            password=db_pass,
            authentication_source="admin",
            alias=CONNECTION_ALIAS,
            maxIdleTimeMS=MAX_IDLE_TIME_MS,
        )
        print(f"Successfully initialized mongodb")
    except Exception as error:
        print(f"Failed mongodb initialization: ", error)


def close_mongodb():
    disconnect(alias=CONNECTION_ALIAS)


def build_query_selector_for_object_ids(ids: list[str] = []) -> dict:
    from bson.objectid import ObjectId
    query_ids = [ObjectId(id) for id in ids]
    return {"_id": {"$in": query_ids}}
