import { Redis, Cluster } from "ioredis";
/**
 * `once`: a connection that never sends a command twice (no retry, no resend after a reconnect, no cluster retry
 * on a closed connection): for the realtime tickets, whose consume must not be replayed after a lost answer.
 */
export function createReleaseBus(config: {
  redisNodes?: { host: string; port: number }[];
  revisionUrl?: string;
  redisUsername?: string;
  redisPassword?: string;
}, options: { once?: boolean } = {}) {
  const busOptions = {
    lazyConnect: true,
    connectTimeout: 2000,
    commandTimeout: 3000,
    maxRetriesPerRequest: options.once ? 0 : 1,
    ...(options.once ? { autoResendUnfulfilledCommands: false } : {}),
    enableOfflineQueue: false,
    username: config.redisUsername,
    password: config.redisPassword,
  };
  return config.redisNodes
    ? new Cluster(config.redisNodes, {
        lazyConnect: true,
        enableOfflineQueue: false,
        // A command on a connection that closed may have run: never retried. MOVED/ASK/TRYAGAIN were refused, so they are.
        ...(options.once ? { retryDelayOnFailover: 0 } : {}),
        redisOptions: busOptions,
      })
    : new Redis(config.revisionUrl!, busOptions);
}
