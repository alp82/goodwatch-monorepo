// Expected TS2740 with redis-storage 1.7.7, ioredis 5.11.1, TS 5.9.3:
// tsc cluster-type-probe.ts --noEmit --strict --skipLibCheck \
//   --module esnext --moduleResolution bundler --target es2022
import { Cluster } from 'ioredis';
import { redisStorage } from '@better-auth/redis-storage';

declare const cluster: Cluster;
redisStorage({ client: cluster });
