// Loop pacing + resilience helpers (pure logic).
// Ported from signa-play (apps/app/lib/vision/pacing.ts).

/**
 * Caps a rAF loop to a fixed cadence: the browser rAF runs at the monitor
 * refresh rate (~117fps on fast machines) and detecting every frame burns GPU
 * with no visual gain. The clock only advances on ALLOWED frames to avoid drift.
 */
export class FrameGate {
  private last = -Infinity;

  constructor(private readonly minIntervalMs: number) {}

  shouldRun(nowMs: number): boolean {
    if (nowMs - this.last < this.minIntervalMs) return false;
    this.last = nowMs;
    return true;
  }
}

/**
 * Failure fuse: N CONSECUTIVE errors latch a permanent fallback (no flicker
 * between modes). A success before the threshold resets the counter.
 */
export class FailureTracker {
  private consecutive = 0;
  private latched = false;

  constructor(private readonly maxConsecutive: number) {}

  get fallenBack(): boolean {
    return this.latched;
  }

  /** Record a failure; returns true if it is (now) in fallback. */
  fail(): boolean {
    this.consecutive += 1;
    if (this.consecutive >= this.maxConsecutive) this.latched = true;
    return this.latched;
  }

  success(): void {
    this.consecutive = 0;
  }
}
