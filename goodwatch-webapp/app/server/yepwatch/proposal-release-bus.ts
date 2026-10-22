import { Redis, Cluster } from "ioredis";
export function createReleaseBus(config: {
  redisNodes?: { host: string; port: number }[];
  revisionUrl?: string;
  redisUsername?: string;
  redisPassword?: string;
}) {
  const busOptions = {
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    username: config.redisUsername,
    password: config.redisPassword,
  };
  return config.redisNodes
    ? new Cluster(config.redisNodes, {
        lazyConnect: true,
        enableOfflineQueue: false,
        redisOptions: busOptions,
      })
    : new Redis(config.revisionUrl!, busOptions);
}
