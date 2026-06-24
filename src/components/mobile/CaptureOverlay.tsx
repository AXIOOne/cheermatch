import { useEffect, useState } from "react";

type Props = {
  /** Whether to attempt to read DeviceOrientation for the level indicator. */
  showLevel?: boolean;
};

/**
 * Visual capture guides overlaid on the live camera feed:
 * - Outer dashed rectangle (full frame)
 * - Inner solid rectangle (safe zone, 8% inset)
 * - Rule-of-thirds grid
 * - Center crosshair
 * - Optional horizon-level indicator (DeviceOrientation)
 *
 * Purely presentational; pointer-events are disabled.
 */
export function CaptureOverlay({ showLevel = true }: Props) {
  const [gamma, setGamma] = useState<number | null>(null);

  useEffect(() => {
    if (!showLevel) return;
    const handler = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma === "number") setGamma(e.gamma);
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, [showLevel]);

  // In landscape, |gamma| ~ 90. Tilt indicator = deviation from 90.
  const tilt =
    gamma == null ? 0 : Math.max(-30, Math.min(30, Math.abs(gamma) - 90));
  const level = gamma != null && Math.abs(tilt) < 2;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Outer dashed frame */}
      <div className="absolute inset-2 border border-dashed border-white/40 rounded-sm" />

      {/* Safe zone */}
      <div className="absolute inset-[8%] border-2 border-primary/70 rounded-md" />

      {/* Rule-of-thirds grid */}
      <div className="absolute inset-[8%] opacity-30">
        <div className="absolute top-1/3 left-0 right-0 border-t border-white" />
        <div className="absolute top-2/3 left-0 right-0 border-t border-white" />
        <div className="absolute left-1/3 top-0 bottom-0 border-l border-white" />
        <div className="absolute left-2/3 top-0 bottom-0 border-l border-white" />
      </div>

      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-3 w-3">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-white/80" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-white/80" />
        </div>
      </div>

      {/* Level indicator */}
      {showLevel && gamma != null && (
        <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-40 h-[3px] bg-white/20 rounded-full overflow-visible">
          <div
            className={`h-full w-full rounded-full origin-center transition-colors ${
              level ? "bg-primary" : "bg-white/70"
            }`}
            style={{ transform: `rotate(${tilt}deg)` }}
          />
        </div>
      )}
    </div>
  );
}
