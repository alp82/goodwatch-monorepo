from rediscluster import RedisCluster # pin: redis-py-cluster
import wmill


class RedisConnector:
    def __init__(self) -> None:
        hosts = wmill.get_variable("u/Alp/REDIS_HOSTS")
        port = wmill.get_variable("u/Alp/REDIS_PORT")
        redis_pass = wmill.get_variable("u/Alp/REDIS_PASS")
        startup_nodes = [{"host": host, "port": port} for host in hosts.split(",")]
        self.r = RedisCluster(
            startup_nodes=startup_nodes,
            password=redis_pass,
            decode_responses=True,
        )

    def debug(self) -> None:
        print(self.r.ping())

    def get_redis(self) -> RedisCluster:
        return self.r


def main():
    pass