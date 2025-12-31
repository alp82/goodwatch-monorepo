from mongoengine import connect, disconnect
import wmill


CONNECTION_ALIAS = "default"
MAX_CONNECT_TIME_MS = 60000
MAX_IDLE_TIME_MS = 120000
MAX_QUERY_TIME_MS = 240000


def init_mongodb():
    print(f"Initializing mongodb...")
    db_user = wmill.get_variable("u/Alp/MONGODB_USER")
    db_pass = wmill.get_variable("u/Alp/MONGODB_PASS")
    db_hosts = wmill.get_variable("u/Alp/MONGODB_HOSTS")
    db_name = wmill.get_variable("u/Alp/MONGODB_DB")
    db_rs = wmill.get_variable("u/Alp/MONGODB_RS")
    connection_string = f"mongodb://{db_user}:{db_pass}@{db_hosts}/{db_name}?replicaSet={db_rs}&retryWrites=true&w=majority&readPreference=primaryPreferred&socketTimeoutMS=45000&connectTimeoutMS=10000&serverSelectionTimeoutMS=30000&appName=windmill"
    try:
        connect(
            host=connection_string,
            # authentication_source="admin",
            alias=CONNECTION_ALIAS,
            connectTimeoutMS=MAX_CONNECT_TIME_MS,
            maxIdleTimeMS=MAX_IDLE_TIME_MS,
            socketTimeoutMS=MAX_QUERY_TIME_MS,
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


def main():
    init_mongodb()
