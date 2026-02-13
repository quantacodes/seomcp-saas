import { describe, test, expect } from "bun:test";
import { ConcurrencyPool } from "../src/services/concurrency-pool";

describe("ConcurrencyPool", () => {
  test("acquire returns a release function", async () => {
    const pool = new ConcurrencyPool(5);
    const release = await pool.acquire();
    expect(typeof release).toBe("function");
    expect(pool.active).toBe(1);
    release();
    expect(pool.active).toBe(0);
  });

  test("tracks active count correctly", async () => {
    const pool = new ConcurrencyPool(5);
    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    const r3 = await pool.acquire();
    expect(pool.active).toBe(3);
    r2();
    expect(pool.active).toBe(2);
    r1();
    r3();
    expect(pool.active).toBe(0);
  });

  test("exposes max", () => {
    const pool = new ConcurrencyPool(10);
    expect(pool.max).toBe(10);
  });

  test("double-release is safe", async () => {
    const pool = new ConcurrencyPool(5);
    const release = await pool.acquire();
    expect(pool.active).toBe(1);
    release();
    release(); // Should not go negative
    expect(pool.active).toBe(0);
  });

  test("queues when full and drains on release", async () => {
    const pool = new ConcurrencyPool(2);
    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    expect(pool.active).toBe(2);

    // This should queue
    let r3Resolved = false;
    const p3 = pool.acquire(5000).then((release) => {
      r3Resolved = true;
      return release;
    });

    // Give microtask a chance to run
    await new Promise((r) => setTimeout(r, 10));
    expect(r3Resolved).toBe(false);
    expect(pool.queued).toBe(1);

    // Release one — should unblock queued
    r1();
    const r3 = await p3;
    expect(r3Resolved).toBe(true);
    expect(pool.active).toBe(2); // r2 + r3
    expect(pool.queued).toBe(0);

    r2();
    r3();
    expect(pool.active).toBe(0);
  });

  test("rejects on timeout when pool is full", async () => {
    const pool = new ConcurrencyPool(1);
    const r1 = await pool.acquire();

    await expect(pool.acquire(50)).rejects.toThrow("Concurrency pool full");
    expect(pool.active).toBe(1);
    r1();
    expect(pool.active).toBe(0);
  });

  test("handles rapid acquire/release cycles", async () => {
    const pool = new ConcurrencyPool(3);
    const releases: (() => void)[] = [];

    for (let i = 0; i < 10; i++) {
      const r = await pool.acquire();
      releases.push(r);
      if (releases.length > 2) {
        releases.shift()!();
      }
    }

    // Clean up
    for (const r of releases) r();
    expect(pool.active).toBe(0);
  });

  test("queued items get processed in FIFO order", async () => {
    const pool = new ConcurrencyPool(1);
    const r1 = await pool.acquire();

    const order: number[] = [];
    const p2 = pool.acquire(5000).then((r) => { order.push(2); return r; });
    const p3 = pool.acquire(5000).then((r) => { order.push(3); return r; });

    r1();

    const r2 = await p2;
    r2();

    const r3 = await p3;
    r3();

    expect(order).toEqual([2, 3]);
    expect(pool.active).toBe(0);
  });
});
