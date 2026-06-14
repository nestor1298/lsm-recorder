# vision — sign-recognition perception layer

Hand-landmark detection ported (web-adapted) from the `signa-play` recognition
stack. MediaPipe `HandLandmarker` (21 landmarks × up to 2 hands) for assisting
manual annotation of handshape (CM), location, and orientation in `/annotate`.

## Modules

| File | Purpose |
| --- | --- |
| `types.ts` | `Landmark` / `HandLandmarks` / `LandmarkExtractor` |
| `extractor.ts` | MediaPipe `HandLandmarker` (GPU→CPU fallback); WASM + model from CDN by default, overridable for self-hosting |
| `handIndicator.ts` | `handsLit()` — which side (Izq/Der) is present |
| `pacing.ts` | `FrameGate` (cadence limiter) + `FailureTracker` |
| `awaitReadyVideo.ts` | wait for a `<video>` to deliver frames |
| `../../hooks/useHandLandmarks.ts` | web hook: load model, run ~30 fps detect loop |
| `../../components/HandLandmarkOverlay.tsx` | canvas overlay drawing the 21-pt skeleton |

## Usage

Wrap the sign `<video>` in a `position: relative` container:

```tsx
import { useRef } from "react";
import HandLandmarkOverlay from "@/components/HandLandmarkOverlay";

const videoRef = useRef<HTMLVideoElement | null>(null);

<div style={{ position: "relative", display: "inline-block" }}>
  <video ref={videoRef} src={annotation.video_url} controls />
  <HandLandmarkOverlay videoRef={videoRef} />
</div>
```

To feed landmarks into annotation logic instead of/with drawing, use the hook:

```tsx
const { handsRef, lit, status } = useHandLandmarks(videoRef, {
  onFrame: (hands, tMs) => { /* snapshot for the current PSHR segment */ },
});
```

## WASM + model hosting

`extractor.ts` defaults to the public MediaPipe CDN. For offline / privacy
deployments, self-host the WASM bundle + `hand_landmarker.task` and pass them:

```ts
createLandmarkExtractor({
  wasmBasePath: "/vendor/mediapipe/wasm",
  modelAssetPath: "/vendor/mediapipe/models/hand_landmarker.task",
});
```
