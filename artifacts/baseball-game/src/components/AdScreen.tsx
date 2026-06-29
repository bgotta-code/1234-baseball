import { useCallback, useEffect, useRef, useState } from 'react';

export interface AdConfig {
  type: 'placeholder' | 'image' | 'video';
  src?: string;
  href?: string;
  ctaLabel?: string;
}

interface AdScreenProps {
  minDuration: number; // tier floor: 5s (Pro) or 10s (free)
  ad?: AdConfig;
  onDone: () => void;
}

export function AdScreen({ minDuration, ad, onDone }: AdScreenProps) {
  const isVideo = ad?.type === 'video' && !!ad.src;

  const [totalDuration, setTotalDuration] = useState(minDuration);
  const [countdown, setCountdown] = useState(minDuration);

  // Always-current refs — safe to call from inside stale interval closures
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const isVideoRef = useRef(isVideo);
  isVideoRef.current = isVideo;

  const timerDoneRef = useRef(false);
  const videoDoneRef = useRef(false);
  const calledDoneRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tryFinish reads from refs so it's always correct even from stale closures
  const tryFinish = useCallback(() => {
    if (calledDoneRef.current) return;
    if (timerDoneRef.current && (!isVideoRef.current || videoDoneRef.current)) {
      calledDoneRef.current = true;
      if (videoFallbackRef.current) clearTimeout(videoFallbackRef.current);
      onDoneRef.current();
    }
  }, []);

  const startCountdown = useCallback((duration: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    let count = duration;
    intervalRef.current = setInterval(() => {
      count--;
      setCountdown(Math.max(count, 0));
      if (count <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        timerDoneRef.current = true;
        tryFinish();
        // Safety net: if a video hasn't ended within 3 extra seconds, force dismiss
        if (isVideoRef.current && !videoDoneRef.current) {
          videoFallbackRef.current = setTimeout(() => {
            videoDoneRef.current = true;
            tryFinish();
          }, 3000);
        }
      }
    }, 1000);
  }, [tryFinish]);

  useEffect(() => {
    timerDoneRef.current = false;
    videoDoneRef.current = false;
    calledDoneRef.current = false;
    if (videoFallbackRef.current) clearTimeout(videoFallbackRef.current);
    setTotalDuration(minDuration);
    setCountdown(minDuration);
    startCountdown(minDuration);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (videoFallbackRef.current) clearTimeout(videoFallbackRef.current);
    };
  }, [minDuration, startCountdown]);

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    const vidDur = Math.ceil(e.currentTarget.duration);
    if (vidDur > minDuration) {
      setTotalDuration(vidDur);
      setCountdown(vidDur);
      startCountdown(vidDur);
    }
  }

  function handleVideoEnded() {
    videoDoneRef.current = true;
    tryFinish();
  }

  function handleVideoError() {
    // If the video fails to load or play, treat it as done so the timer alone decides
    videoDoneRef.current = true;
    tryFinish();
  }

  const pct = totalDuration > 0 ? (countdown / totalDuration) * 100 : 0;

  const content = (() => {
    if (isVideo && ad?.src) {
      return (
        <video
          src={ad.src}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />
      );
    }
    if (ad?.type === 'image' && ad.src) {
      return (
        <img
          src={ad.src}
          alt="Advertisement"
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{
          background: 'linear-gradient(160deg, #0d1117 0%, #161b22 50%, #1c2128 100%)',
        }}
      >
        <div className="text-7xl opacity-20 select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] pointer-events-none">
          ⚾
        </div>
        <div className="relative z-10 text-center px-8">
          <p className="text-white/20 text-xs uppercase tracking-[0.3em] font-semibold mb-3">
            Advertise here
          </p>
          <p className="text-white/60 font-black text-3xl mb-2">Your Ad</p>
          <p className="text-white/30 text-sm">
            Reach baseball fans on every device.
          </p>
          <p className="text-white/20 text-xs mt-4">
            contact us to get started
          </p>
        </div>
      </div>
    );
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Progress bar — top, Stories-style */}
      <div className="absolute top-0 inset-x-0 z-20 h-[3px] bg-white/15">
        <div
          className="h-full bg-white"
          style={{
            width: `${pct}%`,
            transition: 'width 0.95s linear',
          }}
        />
      </div>

      {/* Ad label */}
      <div className="absolute top-4 inset-x-0 z-20 flex justify-center pointer-events-none">
        <span className="text-[10px] text-white/35 uppercase tracking-[0.2em] font-semibold">
          Advertisement
        </span>
      </div>

      {/* 9:16 content area — fills screen on mobile, letterboxed on desktop */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div
          className="relative w-full overflow-hidden"
          style={{
            maxWidth: 'min(100vw, calc(100dvh * 9 / 16))',
            aspectRatio: '9 / 16',
            maxHeight: '100dvh',
          }}
        >
          {content}

          {/* CTA button (if ad has a click-through) */}
          {ad?.href && (
            <a
              href={ad.href}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-20 left-5 right-5 z-10"
            >
              <div className="bg-white rounded-full py-3.5 px-6 text-center font-black text-black text-[15px] shadow-xl">
                {ad.ctaLabel ?? 'Learn More ↗'}
              </div>
            </a>
          )}

          {/* Countdown pill — bottom right */}
          <div className="absolute bottom-5 right-5 z-10">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            >
              <span className="text-white/45 text-[11px]">Next inning in</span>
              <span className="text-white font-black text-[15px] tabular-nums">
                {countdown}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
