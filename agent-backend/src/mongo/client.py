from pymongo import MongoClient
import logging
from typing import Optional
from init.env_variables import DB_URL


class MongoConnection:
    def __init__(self):
        self.mongo_uri = DB_URL
        print(self.mongo_uri)

    def connect(self) -> Optional[MongoClient]:
        try:
            return MongoClient(self.mongo_uri)
        except Exception as e:
            logging.exception(e)
            return None
