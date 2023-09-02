from mongoengine import connect

DB_NAME = "flickvibe"
DB_HOST = "localhost"
DB_PORT = 29017


def init_db():
    connect(db=DB_NAME, host=DB_HOST, port=DB_PORT, alias='default')
