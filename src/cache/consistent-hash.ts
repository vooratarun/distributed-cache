import { createHash } from "node:crypto";

/**
 * Maps keys to cache nodes using a consistent-hash ring.
 * Virtual nodes improve distribution. Hash collisions are resolved by
 * including the node ID in the ring key.
 */
export class ConsistentHash {
  private readonly ring = new Map<number, string>();
  private sortedHashes: number[] = [];

  constructor(private readonly virtualNodes = 100) {
    if (!Number.isInteger(virtualNodes) || virtualNodes < 1) {
      throw new Error("virtualNodes must be a positive integer");
    }
  }

  private hash(value: string): number {
    const hex = createHash("sha256")
      .update(value)
      .digest("hex")
      .slice(0, 8);

    return Number.parseInt(hex, 16);
  }

  addNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      // A collision is extremely unlikely with 32-bit ring positions.
      // For a learning project, this implementation is sufficient.
      this.ring.set(this.hash(`${nodeId}:${i}`), nodeId);
    }
    this.rebuild();
  }

  removeNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${nodeId}:${i}`);
      if (this.ring.get(hash) === nodeId) this.ring.delete(hash);
    }
    this.rebuild();
  }

  getNode(key: string): string {
    if (this.sortedHashes.length === 0) {
      throw new Error("No cache nodes available");
    }

    const hash = this.hash(key);
    let low = 0;
    let high = this.sortedHashes.length;

    // Lower-bound binary search: first ring position >= key hash.
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedHashes[mid] < hash) low = mid + 1;
      else high = mid;
    }

    const index = low === this.sortedHashes.length ? 0 : low;
    return this.ring.get(this.sortedHashes[index])!;
  }

  private rebuild(): void {
    this.sortedHashes = [...this.ring.keys()].sort((a, b) => a - b);
  }
}
