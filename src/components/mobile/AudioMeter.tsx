import { useEffect, useRef, useState } from "react";

type Props = {
  stream: MediaStream | null;
  /** Called once if RMS stays below threshold for 2s. */
  onSilent?: () => void;
  /** When true, silence detection is active (e.g. pre-record). */
  monitorSilence?: boolean;
};

const SEGMENTS = 8;

/**
 * 8-segment vertical VU meter driven from the live mic track.
 * Lights green at normal levels, amber on the top 2 segments when clipping.
 */
export function AudioMeter({ stream, onSilent, monitorSilence = false }: Props) {
  const [level, setLevel] = useState(0); // 0..1
  const silenceStartRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const l = Math.min(1, rms * 3);
      setLevel(l);

      if (monitorSilence && !firedRef.current) {
        const now = performance.now();
        if (l < 0.02) {
          if (silenceStartRef.current == null) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > 2000) {
            firedRef.current = true;
            onSilent?.();
          }
        } else {
          silenceStartRef.current = null;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream, monitorSilence, onSilent]);

  return (
    <div className="flex flex-col-reverse gap-[2px] h-16 w-2" aria-label="Audio level">
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const threshold = (i + 1) / SEGMENTS;
        const active = level >= threshold - 0.0001;
        const hot = i >= SEGMENTS - 2;
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${
              active
                ? hot
                  ? "bg-destructive"
                  : "bg-primary"
                : "bg-white/15"
            }`}
          />
        );
      })}
    </div>
  );
}
