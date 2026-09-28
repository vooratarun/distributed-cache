import Redis from "ioredis";

export interface CacheNode {
  id: string;
  client: Redis;
}

export function createCacheNode(id: string, url: string): CacheNode {
  const client = new Redis(url, {
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true
  });

  return { id, client };
}
