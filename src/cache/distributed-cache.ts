import type Redis from "ioredis";
import { ConsistentHash } from "./consistent-hash.js";
import type { CacheNode } from "../redis/redis-node.js";

export interface DistributedCacheOptions {
  virtualNodes?: number;
  defaultTtlSeconds?: number;
}

export class DistributedCache {
  private readonly ring: ConsistentHash;
  private readonly nodes = new Map<string, Redis>();
  private readonly defaultTtlSeconds: number;

  constructor(cacheNodes: CacheNode[], options: DistributedCacheOptions = {}) {
    if (cacheNodes.length === 0) {
      throw new Error("At least one cache node is required");
    }

    this.ring = new ConsistentHash(options.virtualNodes ?? 100);
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 60;

    for (const node of cacheNodes) {
      if (this.nodes.has(node.id)) {
        throw new Error(`Duplicate cache node ID: ${node.id}`);
      }
      this.nodes.set(node.id, node.client);
      this.ring.addNode(node.id);
    }
  }

  private getClient(key: string): Redis {
    const nodeId = this.ring.getNode(key);
    const client = this.nodes.get(nodeId);
    if (!client) throw new Error(`Cache node not found: ${nodeId}`);
    return client;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.getClient(key).get(key);
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      throw new Error(`Cached value for "${key}" is not valid JSON`);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = this.defaultTtlSeconds): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error("ttlSeconds must be a positive number");
    }

    await this.getClient(key).set(key, JSON.stringify(value), "EX", Math.ceil(ttlSeconds));
  }

  async delete(key: string): Promise<boolean> {
    return (await this.getClient(key).del(key)) > 0;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getClient(key).exists(key)) === 1;
  }

  /** Returns the node ID selected for a key; useful for demos and diagnostics. */
  getNodeForKey(key: string): string {
    return this.ring.getNode(key);
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.nodes.values()].map(async (client) => {
        if (client.status === "wait") {
          // A lazy, never-connected client has nothing to close.
          client.disconnect();
          return;
        }
        if (client.status === "end") return;
        await client.quit();
      })
    );
  }
}
