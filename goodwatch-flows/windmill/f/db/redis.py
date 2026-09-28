# extra_requirements:
# redis==5.2.1
from redis.cluster import ClusterNode, RedisCluster
import wmill


class RedisConnector:
    def __init__(self, decode_responses: bool = True) -> None:
        """decode_responses=False returns bytes, for binary values."""
        hosts = wmill.get_variable("u/Alp/REDIS_HOSTS")
        port = int(wmill.get_variable("u/Alp/REDIS_PORT"))
        redis_pass = wmill.get_variable("u/Alp/REDIS_PASS")
        startup_nodes = [ClusterNode(host.strip(), port) for host in hosts.split(",") if host.strip()]
        self.r = RedisCluster(
            startup_nodes=startup_nodes,
            password=redis_pass,
            decode_responses=decode_responses,
        )

    def debug(self) -> None:
        print(self.r.ping())

    def get_redis(self) -> RedisCluster:
        return self.r


def main():
    pass
