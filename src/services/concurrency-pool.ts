/**
 * Bounded semaphore for limiting concurrent proxy binary spawns.
 * Prevents OOM from too many simultaneous Rust binary processes.
 */

export class ConcurrencyPool {
  private _active = 0;
  private _queue: Array<{
    resolve: (release: () => void) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(private _max: number) {}

  /**
   * Acquire a slot from the pool.
   * Returns a release function that MUST be called when done.
   * Rejects with Error if timeoutMs elapses while waiting in queue.
   */
  acquire(timeoutMs = 10_000): Promise<() => void> {
    if (this._active < this._max) {
      this._active++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this._active--;
        this._drainQueue();
      };
      return Promise.resolve(release);
    }

    // Queue the request
    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from queue on timeout
        const idx = this._queue.findIndex((e) => e.resolve === resolve);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error("Concurrency pool full — try again later"));
      }, timeoutMs);

      this._queue.push({ resolve, reject, timer });
    });
  }

  /**
   * Drain queued waiters when a slot becomes available.
   */
  private _drainQueue(): void {
    while (this._queue.length > 0 && this._active < this._max) {
      const entry = this._queue.shift()!;
      clearTimeout(entry.timer);
      this._active++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this._active--;
        this._drainQueue();
      };
      entry.resolve(release);
    }
  }

  get active(): number {
    return this._active;
  }

  get max(): number {
    return this._max;
  }

  get queued(): number {
    return this._queue.length;
  }
}
