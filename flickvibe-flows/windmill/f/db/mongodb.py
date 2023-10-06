from mongoengine import connect
import wmill


def init_mongodb():
    print(f"Initializing mongodb...")
    try:
        db_name = wmill.get_variable("u/Alp/MONGODB_DB")
        db_host = wmill.get_variable("u/Alp/MONGODB_HOST")
        db_port = int(wmill.get_variable("u/Alp/MONGODB_PORT"))
        db_user = wmill.get_variable("u/Alp/MONGODB_USER")
        db_pass = wmill.get_variable("u/Alp/MONGODB_PASS")
        connect(
            db=db_name,
            host=db_host,
            port=db_port,
            username=db_user,
            password=db_pass,
            authentication_source="admin",
            alias="default",
        )
        print(f"Successfully initialized mongodb")
    except Exception as error:
        print(f"Failed mongodb initialization", error)
