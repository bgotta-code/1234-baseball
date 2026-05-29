export interface AdConfig {
  type: 'placeholder' | 'image' | 'video';
  src?: string;
  href?: string;
  ctaLabel?: string;
}

interface AdScreenProps {
  countdown: number;
  duration: number;
  ad?: AdConfig;
}

export function AdScreen({ countdown, duration, ad }: AdScreenProps) {
  const pct = duration > 0 ? (countdown / duration) * 100 : 0;

  const content = (() => {
    if (ad?.type === 'video' && ad.src) {
      return (
        <video
          src={ad.src}
          autoPlay
          muted
          playsInline
          loop
          className="absolute inset-0 w-full h-full object-cover"
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
