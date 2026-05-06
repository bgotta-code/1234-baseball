// ── Coordinates (ViewBox 0 0 300 295) ───────────────────────────────────────
const HOME   = { x: 150, y: 273 };
const FIRST  = { x: 212, y: 211 };
const SECOND = { x: 150, y: 149 };
const THIRD  = { x: 88,  y: 211 };
const MOUND  = { x: 150, y: 212 };

// Map runner position number → SVG coordinates
// 0=home plate, 1=1st, 2=2nd, 3=3rd
const BASE_XY: Record<number, { x: number; y: number }> = {
  0: HOME,
  1: FIRST,
  2: SECOND,
  3: THIRD,
  4: HOME, // scored — animates back to home plate before disappearing
};

// Fielding positions
const FIELDERS = [
  { x: 149, y: 215, label: 'P'  },
  { x: 151, y: 282, label: 'C'  },
  { x: 223, y: 194, label: '1B' }, // moved back (up) ~13px
  { x: 185, y: 156, label: '2B' }, // moved back ~14px
  { x: 115, y: 156, label: 'SS' }, // moved back ~14px
  { x: 77,  y: 194, label: '3B' }, // moved back ~13px
  { x: 76,  y: 118, label: 'LF' }, // moved in ~15px
  { x: 150, y: 90,  label: 'CF' }, // moved in ~20px
  { x: 224, y: 118, label: 'RF' }, // moved in ~15px
];

// ── Static fielder / batter dot ───────────────────────────────────────────────
interface PlayerDotProps {
  x: number; y: number;
  color?: string;
  size?: number;
  label?: string;
}
function PlayerDot({ x, y, color = '#1e3a8a', size = 5.5, label }: PlayerDotProps) {
  return (
    <g>
      <ellipse cx={x} cy={y + size * 0.9} rx={size * 1.1} ry={size * 0.4} fill="rgba(0,0,0,0.25)" />
      <circle cx={x} cy={y} r={size} fill={color} stroke="white" strokeWidth="1.3" />
      <circle cx={x} cy={y - size * 0.5} r={size * 0.42} fill="#f5d5a8" stroke="white" strokeWidth="0.7" />
      {label && (
        <text x={x} y={y + size + 9} textAnchor="middle" fontSize="6.5"
          fill="rgba(255,255,255,0.8)" fontWeight="700" fontFamily="system-ui,sans-serif">
          {label}
        </text>
      )}
    </g>
  );
}

// ── Animated runner dot (cx/cy transition via CSS .runner-part) ───────────────
// Each element gets className="runner-part" so CSS applies the transition.
// When cx/cy props change React updates the DOM attributes,
// and the browser smoothly animates between positions.
function RunnerDot({ x, y }: { x: number; y: number }) {
  const sz = 6.5;
  return (
    <>
      <ellipse
        className="runner-part"
        cx={x} cy={y + sz * 0.85}
        rx={sz * 1.1} ry={sz * 0.38}
        fill="rgba(0,0,0,0.28)"
      />
      <circle
        className="runner-part"
        cx={x} cy={y} r={sz}
        fill="#e85d04" stroke="white" strokeWidth="1.4"
      />
      <circle
        className="runner-part"
        cx={x} cy={y - sz * 0.5} r={sz * 0.42}
        fill="#f5d5a8" stroke="white" strokeWidth="0.75"
      />
    </>
  );
}

// ── Component interface ───────────────────────────────────────────────────────
interface AnimRunner { id: string; pos: number }

interface StadiumProps {
  bases: [boolean, boolean, boolean];
  phase: 'pitch' | 'swing';
  awayTeam: string;
  homeTeam: string;
  battingTeam: 0 | 1;
  /** When set, overrides static base display with step-animated runners */
  runners?: AnimRunner[];
}

export function Stadium({ bases, phase, battingTeam, runners }: StadiumProps) {
  const isAnimating = runners !== undefined;

  // Determine which bases appear occupied — follow animation positions if active
  const animOccupied = isAnimating
    ? new Set(runners!.map(r => r.pos))
    : null;
  const base1Lit = animOccupied ? animOccupied.has(1) : bases[0];
  const base2Lit = animOccupied ? animOccupied.has(2) : bases[1];
  const base3Lit = animOccupied ? animOccupied.has(3) : bases[2];

  const DIRT_R = { x: 214, y: 209 };
  const DIRT_L = { x: 86,  y: 209 };
  const DIRT_ARC_R = 66;

  return (
    <svg viewBox="0 0 300 295" width="100%" style={{ display: 'block', maxHeight: 245 }}>
      <defs>
        <radialGradient id="fieldGrad" cx="50%" cy="65%" r="65%">
          <stop offset="0%" stopColor="#45a045" />
          <stop offset="100%" stopColor="#2c7a2c" />
        </radialGradient>
        <radialGradient id="dirtGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#ca9a5c" />
          <stop offset="100%" stopColor="#b07a3a" />
        </radialGradient>
        <radialGradient id="innerGrassGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#48a848" />
          <stop offset="100%" stopColor="#2e8c2e" />
        </radialGradient>
        <clipPath id="fieldShape">
          <path d={`M ${HOME.x},${HOME.y} L 8,140 Q 150,3 292,140 L ${HOME.x},${HOME.y} Z`} />
        </clipPath>
      </defs>

      {/* Outfield grass */}
      <path
        d={`M ${HOME.x},${HOME.y} L 8,140 Q 150,3 292,140 L ${HOME.x},${HOME.y} Z`}
        fill="url(#fieldGrad)"
      />
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i} x={i * 37.5} y={0} width={18.75} height={295}
          fill="rgba(0,0,0,0.04)" clipPath="url(#fieldShape)" />
      ))}

      {/* Outfield fence line */}
      <path d="M 8,140 Q 150,3 292,140" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />

      {/* Foul lines */}
      <line x1={HOME.x} y1={HOME.y} x2={8}   y2={140} stroke="white" strokeWidth="1.4" opacity="0.7" />
      <line x1={HOME.x} y1={HOME.y} x2={292} y2={140} stroke="white" strokeWidth="1.4" opacity="0.7" />

      {/* Infield dirt D-shape */}
      <path
        d={`M ${HOME.x},${HOME.y} L ${DIRT_R.x},${DIRT_R.y} A ${DIRT_ARC_R},${DIRT_ARC_R} 0 1 0 ${DIRT_L.x},${DIRT_L.y} L ${HOME.x},${HOME.y} Z`}
        fill="url(#dirtGrad)"
      />

      {/* Baseline chalk on dirt */}
      <line x1={HOME.x} y1={HOME.y} x2={FIRST.x} y2={FIRST.y} stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
      <line x1={HOME.x} y1={HOME.y} x2={THIRD.x} y2={THIRD.y} stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />

      {/* Infield grass diamond */}
      <polygon
        points={`${SECOND.x},${SECOND.y} ${FIRST.x},${FIRST.y} ${HOME.x},${HOME.y} ${THIRD.x},${THIRD.y}`}
        fill="url(#innerGrassGrad)"
      />

      {/* Baseline chalk on grass */}
      <line x1={HOME.x} y1={HOME.y}   x2={FIRST.x}  y2={FIRST.y}  stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      <line x1={FIRST.x} y1={FIRST.y}  x2={SECOND.x} y2={SECOND.y} stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      <line x1={SECOND.x} y1={SECOND.y} x2={THIRD.x} y2={THIRD.y} stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      <line x1={THIRD.x} y1={THIRD.y}  x2={HOME.x}  y2={HOME.y}   stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />

      {/* Pitcher's mound */}
      <ellipse cx={MOUND.x} cy={MOUND.y} rx="9" ry="7" fill="#ca9a5c" stroke="#a07535" strokeWidth="0.8" />
      <rect x={MOUND.x - 5} y={MOUND.y - 1} width="10" height="2.5" rx="0.5" fill="white" opacity="0.85" />

      {/* Home plate dirt circle */}
      <circle cx={HOME.x} cy={HOME.y - 4} r="20" fill="#ca9a5c" />

      {/* On-deck circles */}
      <circle cx="107" cy="270" r="8" fill="#b07a3a" opacity="0.8" />
      <circle cx="193" cy="270" r="8" fill="#b07a3a" opacity="0.8" />

      {/* Bases — highlight color follows runner positions (animated or static) */}
      <rect x={SECOND.x - 6} y={SECOND.y - 6} width="12" height="12" rx="1.5"
        fill={base2Lit ? '#f5a623' : 'white'}
        stroke={base2Lit ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${SECOND.x},${SECOND.y})`}
        style={{ transition: 'fill 0.25s' }}
      />
      <rect x={FIRST.x - 6} y={FIRST.y - 6} width="12" height="12" rx="1.5"
        fill={base1Lit ? '#f5a623' : 'white'}
        stroke={base1Lit ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${FIRST.x},${FIRST.y})`}
        style={{ transition: 'fill 0.25s' }}
      />
      <rect x={THIRD.x - 6} y={THIRD.y - 6} width="12" height="12" rx="1.5"
        fill={base3Lit ? '#f5a623' : 'white'}
        stroke={base3Lit ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${THIRD.x},${THIRD.y})`}
        style={{ transition: 'fill 0.25s' }}
      />

      {/* Home plate */}
      <polygon
        points={`${HOME.x - 6},${HOME.y - 5} ${HOME.x + 6},${HOME.y - 5} ${HOME.x + 6},${HOME.y + 1} ${HOME.x},${HOME.y + 6} ${HOME.x - 6},${HOME.y + 1}`}
        fill="white" stroke="#bbb" strokeWidth="0.7"
      />
      <rect x={HOME.x - 22} y={HOME.y - 9}  width="13" height="18" rx="1" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />
      <rect x={HOME.x + 9}  y={HOME.y - 9}  width="13" height="18" rx="1" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" />

      {/* Fielders */}
      {FIELDERS.map(f => (
        <PlayerDot key={f.label} x={f.x} y={f.y}
          color={battingTeam === 0 ? '#1e3a8a' : '#7f1d1d'}
          size={5.5} label={f.label}
        />
      ))}

      {/* ── RUNNERS ─────────────────────────────────────────────────────────── */}
      {isAnimating
        ? /* Animated: RunnerDot with CSS cx/cy transition, stable keys */
          runners!.map(r => {
            const coord = BASE_XY[Math.min(r.pos, 3)] ?? HOME;
            return <RunnerDot key={r.id} x={coord.x} y={coord.y} />;
          })
        : /* Static: plain PlayerDots exactly on base centers */
          <>
            {bases[0] && <PlayerDot x={FIRST.x}  y={FIRST.y}  color="#e85d04" size={6.5} />}
            {bases[1] && <PlayerDot x={SECOND.x} y={SECOND.y} color="#e85d04" size={6.5} />}
            {bases[2] && <PlayerDot x={THIRD.x}  y={THIRD.y}  color="#e85d04" size={6.5} />}
          </>
      }

      {/* Batter — hidden while animation is running (batter is in runners array at pos=0) */}
      {!isAnimating && (
        <PlayerDot
          x={HOME.x - 17} y={HOME.y - 3}
          color={phase === 'swing' ? '#f97316' : '#e85d04'}
          size={7}
        />
      )}
    </svg>
  );
}
