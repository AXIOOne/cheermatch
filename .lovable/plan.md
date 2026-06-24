
# Plan: Mobile video capture UX upgrades

Targeting `src/pages/mobile/MobileRecord.tsx` plus a small device-detection helper. iPhone is the primary device; iPad allowed; laptops blocked from capture.

## 1. Device gate (block laptops, auto-detect iPhone/iPad)

New helper `src/lib/device-detect.ts`:
- Returns `{ kind: "phone" | "tablet" | "desktop", os: "ios" | "android" | "other" }` from `navigator.userAgent` + `navigator.maxTouchPoints` (catches iPad masquerading as desktop Safari).

In `MobileRecord.tsx`:
- On mount, if `kind === "desktop"`, short-circuit before `getUserMedia` and render a blocking card: "Video capture is only available on a phone or tablet. Please open this link on your iPhone or iPad." with a Back button. No webcam fallback.
- First-launch confirmation: after detection, show a one-time sheet "Detected: iPhone — is that right?" with Yes / Pick another (Phone | Tablet). Persist answer in `localStorage` under `cm.captureDevice`. Skip the sheet on subsequent visits.
- The detected/confirmed device tunes UI density (larger HUD on tablet, thumb-reach Stop placement on phone).

## 2. Core capture hardening

In the existing `getUserMedia` call:
- Request `frameRate: { ideal: 30, max: 30 }` alongside current 1920×1080 / `facingMode: environment`.
- Add `audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }` so music isn't ducked.
- Pick MediaRecorder bitrate: `videoBitsPerSecond: 6_000_000`, `audioBitsPerSecond: 128_000`.

Keep-awake + interruption:
- Acquire `navigator.wakeLock.request("screen")` when entering `recording`; release on `stop`/unmount. Re-acquire on `visibilitychange` if still recording.
- Listen for `stream` track `ended` / `mute` events; if fired mid-recording, auto-stop and toast "Recording interrupted — please retake."

Landscape:
- Keep the existing rotate-prompt overlay. Already correct for iOS Safari (lock unsupported).

## 3. Safe-zone + level overlay

New presentational component `CaptureOverlay` rendered absolutely over the live `<video>` during `ready` and `recording` phases only (hidden in `preview`):
- Outer dashed rectangle aligned to video bounds = full frame.
- Inner solid rectangle inset 8% on each side = safe zone (semantic `border-primary/70`).
- Rule-of-thirds grid (two vertical + two horizontal thin lines at 33%/66%) at 30% opacity.
- Center crosshair (12px).
- Horizon level: subscribe to `DeviceOrientationEvent` (request permission on iOS 13+ via `DeviceOrientationEvent.requestPermission()` on first Start tap). Render a thin horizontal bar that tilts opposite to `gamma`; turns `text-primary` when |gamma - 90| < 2° (landscape held level), otherwise muted.
- Toggle button (grid icon) in the top-right of the capture HUD, persisted to `localStorage` under `cm.captureOverlay` (default on).

All colors use existing semantic tokens; no hardcoded hex.

## 4. Pre-roll countdown + post-capture review

Add a new phase `"countdown"` between `ready` and `recording`:
- `startRecording()` becomes `beginCountdown()`: sets phase to `countdown`, shows large 3 → 2 → 1 in the center of the live view (1s each), then calls the existing recorder start logic.
- During countdown the Stop/Start button is replaced by a Cancel button that aborts the countdown back to `ready`.

Post-capture (existing `preview` phase) — minor polish only:
- Rename the primary button to **Use This Take** and add a secondary **Retake** button (`recordAnother()` already exists; just expose it inline instead of only after `Continue`).
- Auto-show playback at full size (already wired via `videoPreviewRef`).

Tail capture: don't auto-extend the file (codec complexity); instead nudge the user via existing UI — out of scope for this iteration.

## 5. Operator HUD

Replace the small top pill with a full HUD bar overlaid on the live view:
- **Top strip** (landscape): REC dot + `MM:SS / MM:SS` timer (large, `font-mono`), attempt counter `Take {n}/{max}`, battery % via `navigator.getBattery()` (graceful fallback if undefined), storage estimate via `navigator.storage.estimate()` shown as "Free: X GB" (refreshed once on mount).
- **Audio VU meter**: 8-segment vertical bar driven by `AudioContext` + `AnalyserNode` reading from the mic track. Lights green at normal levels, amber when clipping. Warn (toast once) if RMS stays below threshold for 2s pre-record.
- **Stop button placement**: in landscape, render the big Stop button anchored bottom-right within thumb reach (right-hand grip assumed). On tablet, render centered and larger.
- Re-uses existing semantic tokens (`bg-destructive`, `text-primary`, `bg-background/70`, etc.).

## 6. Technical notes

- All new state is local to `MobileRecord`; no backend, schema, or edge-function changes.
- New file: `src/lib/device-detect.ts` (~30 lines).
- New file: `src/components/mobile/CaptureOverlay.tsx` (safe zone + grid + level).
- New file: `src/components/mobile/AudioMeter.tsx` (reads `streamRef.current`).
- Edits: `src/pages/mobile/MobileRecord.tsx` (phase enum gains `"blocked" | "countdown"`, HUD restructured, device gate, wake lock, overlay toggle, Retake button).
- No package additions; everything uses Web APIs already supported in iOS Safari 16+ (target for current Capacitor build).
- iOS DeviceOrientation permission must be requested from a user gesture — wire it into the first Start tap and cache the grant.

## Out of scope (can be follow-ups)

- Tap-to-focus / AE-AF lock (requires `ImageCapture` API quirks on iOS, may need Capacitor plugin).
- Burn-in metadata overlay on the recorded file (would need canvas re-encode).
- Background-upload resume beyond the current Brightcove flow.
- Filename sidecar metadata changes (already partly handled in `uploadComplete`).
