import { createCacheNode } from "./redis/redis-node.js";
import { DistributedCache } from "./cache/distributed-cache.js";

async function main(): Promise<void> {
  const nodes = [
    createCacheNode("redis-a", process.env.REDIS_A_URL ?? "redis://localhost:6379"),
    createCacheNode("redis-b", process.env.REDIS_B_URL ?? "redis://localhost:6380"),
    createCacheNode("redis-c", process.env.REDIS_C_URL ?? "redis://localhost:6381")
  ];

  const cache = new DistributedCache(nodes, {
    virtualNodes: 100,
    defaultTtlSeconds: 60
  });

  try {
    const user = {
      id: 101,
      name: "Tarun",
      role: "Backend Engineer"
    };

    console.log("Selected node:", cache.getNodeForKey("user:101"));
    await cache.set("user:101", user, 300);

    const result = await cache.get<typeof user>("user:101");
    console.log("Cached user:", result);

    console.log("Exists:", await cache.exists("user:101"));
    console.log("Deleted:", await cache.delete("user:101"));
    console.log("After delete:", await cache.get("user:101"));
  } finally {
    await cache.close();
  }
}

main().catch((error: unknown) => {
  console.error("Distributed cache demo failed:", error);
  process.exitCode = 1;
});
