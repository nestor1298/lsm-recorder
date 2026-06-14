// Resilient wait for a <video> to report dimensions (videoWidth > 0) before
// starting the detection loop. Ported from signa-play.
//
// Why it exists: the camera (or, for annotation, a loaded recording) can take a
// while to deliver frames — permission granted late, camera warm-up, or the
// model download competing for bandwidth. A generous budget (default 60s) and a
// pure/injectable shape make it testable without DOM or a real clock.

/** The minimum we need from an HTMLVideoElement (avoids lib.dom in node tests). */
export interface ReadyVideoLike {
  videoWidth: number;
}

export interface AwaitReadyVideoOpts {
  /** true once the screen unmounted: abort without touching state. */
  isCancelled: () => boolean;
  /** injectable wait (app: setTimeout; tests: resolve immediately). */
  sleep: (ms: number) => Promise<void>;
  /** poll cadence. Default 150ms. */
  intervalMs?: number;
  /** total budget before giving up. Default 60s. */
  timeoutMs?: number;
}

export type AwaitReadyVideoResult<T extends ReadyVideoLike> =
  | { status: "ready"; video: T }
  | { status: "cancelled" }
  | { status: "timeout" };

export async function awaitReadyVideo<T extends ReadyVideoLike>(
  getVideo: () => T | null,
  opts: AwaitReadyVideoOpts,
): Promise<AwaitReadyVideoResult<T>> {
  const intervalMs = opts.intervalMs ?? 150;
  const timeoutMs = opts.timeoutMs ?? 60000;
  let waited = 0;
  // Re-query the video each turn: if the element is replaced (e.g. remount),
  // bind to the live one instead of a stale reference.
  for (;;) {
    if (opts.isCancelled()) return { status: "cancelled" };
    const v = getVideo();
    if (v && v.videoWidth > 0) return { status: "ready", video: v };
    if (waited >= timeoutMs) return { status: "timeout" };
    await opts.sleep(intervalMs);
    waited += intervalMs;
  }
}
