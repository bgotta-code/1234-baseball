interface StadiumProps {
  bases: [boolean, boolean, boolean];
  phase: 'pitch' | 'swing';
  awayTeam: string;
  homeTeam: string;
  battingTeam: 0 | 1; // 0=away, 1=home
}

// Field coordinates — ViewBox 0 0 300 295
const HOME   = { x: 150, y: 273 };
const FIRST  = { x: 212, y: 211 };
const SECOND = { x: 150, y: 149 };
const THIRD  = { x: 88,  y: 211 };
const MOUND  = { x: 150, y: 212 };

// Fielding positions (home team in field)
const FIELDERS = [
  { x: 149, y: 215, label: 'P'  },  // pitcher (on mound)
  { x: 151, y: 258, label: 'C'  },  // catcher
  { x: 220, y: 207, label: '1B' },
  { x: 183, y: 170, label: '2B' },
  { x: 117, y: 170, label: 'SS' },
  { x: 80,  y: 207, label: '3B' },
  { x: 62,  y: 103, label: 'LF' },
  { x: 150, y: 70,  label: 'CF' },
  { x: 238, y: 103, label: 'RF' },
];

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

export function Stadium({ bases, phase, battingTeam }: StadiumProps) {
  const [onFirst, onSecond, onThird] = bases;

  // Infield dirt arc: center (150, 190), radius 66
  // Arc from slightly-past-1B through above-2B to slightly-past-3B
  const DIRT_ARC_R = 66;
  const DIRT_ARC_CX = 150;
  const DIRT_ARC_CY = 190;
  // Endpoints of dirt arc (where the baselines meet the arc)
  const DIRT_R = { x: 214, y: 209 };
  const DIRT_L = { x: 86,  y: 209 };

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

      {/* ── OUTFIELD GRASS ── */}
      <path
        d={`M ${HOME.x},${HOME.y} L 8,140 Q 150,3 292,140 L ${HOME.x},${HOME.y} Z`}
        fill="url(#fieldGrad)"
      />

      {/* Subtle mowing stripes */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <rect key={i}
          x={i * 37.5} y={0} width={18.75} height={295}
          fill="rgba(0,0,0,0.04)"
          clipPath="url(#fieldShape)"
        />
      ))}

      {/* ── OUTFIELD FENCE LINE ── */}
      <path
        d="M 8,140 Q 150,3 292,140"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"
      />

      {/* ── FOUL LINES ── */}
      <line x1={HOME.x} y1={HOME.y} x2={8}   y2={140}
        stroke="white" strokeWidth="1.4" opacity="0.7"/>
      <line x1={HOME.x} y1={HOME.y} x2={292} y2={140}
        stroke="white" strokeWidth="1.4" opacity="0.7"/>

      {/* ── INFIELD DIRT (large D-shape arc) ── */}
      <path
        d={`
          M ${HOME.x},${HOME.y}
          L ${DIRT_R.x},${DIRT_R.y}
          A ${DIRT_ARC_R},${DIRT_ARC_R} 0 1 0 ${DIRT_L.x},${DIRT_L.y}
          L ${HOME.x},${HOME.y}
          Z
        `}
        fill="url(#dirtGrad)"
      />

      {/* ── FOUL LINE OVERLAP on dirt (chalk marks) ── */}
      <line x1={HOME.x} y1={HOME.y} x2={FIRST.x}  y2={FIRST.y}
        stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"/>
      <line x1={HOME.x} y1={HOME.y} x2={THIRD.x} y2={THIRD.y}
        stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"/>

      {/* ── INFIELD GRASS (green diamond inside the dirt) ── */}
      <polygon
        points={`${SECOND.x},${SECOND.y} ${FIRST.x},${FIRST.y} ${HOME.x},${HOME.y} ${THIRD.x},${THIRD.y}`}
        fill="url(#innerGrassGrad)"
      />

      {/* Baseline chalk lines on grass */}
      <line x1={HOME.x} y1={HOME.y} x2={FIRST.x} y2={FIRST.y}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
      <line x1={FIRST.x} y1={FIRST.y} x2={SECOND.x} y2={SECOND.y}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
      <line x1={SECOND.x} y1={SECOND.y} x2={THIRD.x} y2={THIRD.y}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
      <line x1={THIRD.x} y1={THIRD.y} x2={HOME.x} y2={HOME.y}
        stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>

      {/* ── PITCHER'S MOUND ── */}
      <ellipse cx={MOUND.x} cy={MOUND.y} rx="9" ry="7"
        fill="#ca9a5c" stroke="#a07535" strokeWidth="0.8"/>
      {/* Pitcher's rubber */}
      <rect x={MOUND.x - 5} y={MOUND.y - 1} width="10" height="2.5" rx="0.5"
        fill="white" opacity="0.85"/>

      {/* ── HOME PLATE DIRT CIRCLE ── */}
      <circle cx={HOME.x} cy={HOME.y - 4} r="20" fill="#ca9a5c"/>

      {/* ── ON-DECK CIRCLES ── */}
      <circle cx="107" cy="270" r="8" fill="#b07a3a" opacity="0.8"/>
      <circle cx="193" cy="270" r="8" fill="#b07a3a" opacity="0.8"/>

      {/* ── DUGOUT BOXES (foul territory) ── */}
      {/* Left dugout (3B side) */}
      <rect x="-13" y="-7" width="30" height="13" rx="1.5"
        fill="white" opacity="0.85"
        transform="translate(44,228) rotate(-44)"/>
      {/* Right dugout (1B side) */}
      <rect x="-13" y="-7" width="30" height="13" rx="1.5"
        fill="white" opacity="0.85"
        transform="translate(256,228) rotate(44)"/>

      {/* ── BASES ── */}
      {/* Second base */}
      <rect x={SECOND.x - 6} y={SECOND.y - 6} width="12" height="12" rx="1.5"
        fill={onSecond ? '#f5a623' : 'white'}
        stroke={onSecond ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${SECOND.x},${SECOND.y})`}
        style={{ transition: 'fill 0.25s' }}
      />
      {/* First base */}
      <rect x={FIRST.x - 6} y={FIRST.y - 6} width="12" height="12" rx="1.5"
        fill={onFirst ? '#f5a623' : 'white'}
        stroke={onFirst ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${FIRST.x},${FIRST.y})`}
        style={{ transition: 'fill 0.25s' }}
      />
      {/* Third base */}
      <rect x={THIRD.x - 6} y={THIRD.y - 6} width="12" height="12" rx="1.5"
        fill={onThird ? '#f5a623' : 'white'}
        stroke={onThird ? '#c07800' : '#ccc'} strokeWidth="0.8"
        transform={`rotate(45,${THIRD.x},${THIRD.y})`}
        style={{ transition: 'fill 0.25s' }}
      />

      {/* ── HOME PLATE ── */}
      <polygon
        points={`${HOME.x},${HOME.y - 6} ${HOME.x + 6},${HOME.y - 1} ${HOME.x + 6},${HOME.y + 5} ${HOME.x - 6},${HOME.y + 5} ${HOME.x - 6},${HOME.y - 1}`}
        fill="white" stroke="#bbb" strokeWidth="0.7"
      />

      {/* Batter's boxes */}
      <rect x={HOME.x - 22} y={HOME.y - 9}  width="13" height="18" rx="1"
        fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9"/>
      <rect x={HOME.x + 9}  y={HOME.y - 9}  width="13" height="18" rx="1"
        fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9"/>

      {/* ── FIELDERS (home team defending) ── */}
      {FIELDERS.map(f => (
        <PlayerDot
          key={f.label}
          x={f.x} y={f.y}
          color={battingTeam === 0 ? '#1e3a8a' : '#7f1d1d'}
          size={5.5}
          label={f.label}
        />
      ))}

      {/* ── RUNNERS ON BASE ── */}
      {onFirst  && <PlayerDot x={FIRST.x - 13}  y={FIRST.y  - 2}  color="#e85d04" size={6.5} />}
      {onSecond && <PlayerDot x={SECOND.x + 13} y={SECOND.y + 2}  color="#e85d04" size={6.5} />}
      {onThird  && <PlayerDot x={THIRD.x + 13}  y={THIRD.y  - 2}  color="#e85d04" size={6.5} />}

      {/* ── BATTER ── */}
      <PlayerDot
        x={HOME.x - 17}
        y={HOME.y - 3}
        color={phase === 'swing' ? '#f97316' : '#e85d04'}
        size={7}
      />
    </svg>
  );
}
