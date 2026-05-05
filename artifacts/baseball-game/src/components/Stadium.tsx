interface StadiumProps {
  bases: [boolean, boolean, boolean];
  phase: 'pitch' | 'swing';
}

// Key coordinate anchors (viewBox 0 0 300 270)
const HOME = { x: 150, y: 250 };
const FIRST = { x: 202, y: 198 };
const SECOND = { x: 150, y: 146 };
const THIRD = { x: 98, y: 198 };
const MOUND = { x: 150, y: 198 };

// Fielder positions
const FIELDERS = [
  { x: 183, y: 162, label: '2B' },
  { x: 117, y: 162, label: 'SS' },
  { x: 215, y: 194, label: '1B' },
  { x: 85, y: 194, label: '3B' },
  { x: 66, y: 102, label: 'LF' },
  { x: 150, y: 68, label: 'CF' },
  { x: 234, y: 102, label: 'RF' },
];

function PlayerDot({
  x, y, color = '#1e3a6e', size = 6, label,
}: { x: number; y: number; color?: string; size?: number; label?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + size * 0.9} rx={size * 1.1} ry={size * 0.45} fill="rgba(0,0,0,0.22)" />
      <circle cx={x} cy={y} r={size} fill={color} stroke="white" strokeWidth="1.4" />
      <circle cx={x} cy={y - size * 0.52} r={size * 0.44} fill="#f5d5a8" stroke="white" strokeWidth="0.8" />
      {label && (
        <text x={x} y={y + size + 9} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.75)" fontWeight="600"
          fontFamily="-apple-system,sans-serif">
          {label}
        </text>
      )}
    </g>
  );
}

export function Stadium({ bases, phase }: StadiumProps) {
  const [onFirst, onSecond, onThird] = bases;

  return (
    <svg
      viewBox="0 0 300 270"
      width="100%"
      style={{ display: 'block', maxHeight: 240 }}
      aria-label="Baseball field"
    >
      <defs>
        <radialGradient id="outfieldGrad" cx="50%" cy="60%" r="70%">
          <stop offset="0%" stopColor="#2a7c2a" />
          <stop offset="100%" stopColor="#1b5c1b" />
        </radialGradient>
        <radialGradient id="infieldDirtGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#c4905f" />
          <stop offset="100%" stopColor="#a87040" />
        </radialGradient>
        <radialGradient id="infieldGrassGrad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#339933" />
          <stop offset="100%" stopColor="#256625" />
        </radialGradient>
        <clipPath id="fieldClip">
          <path d="M 2,270 L 2,165 Q 150,2 298,165 L 298,270 Z" />
        </clipPath>
      </defs>

      {/* === OUTFIELD GRASS === */}
      <path d="M 2,270 L 2,165 Q 150,2 298,165 L 298,270 Z" fill="url(#outfieldGrad)" />

      {/* Outfield grass stripes (mowing pattern) */}
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <path
          key={i}
          d={`M ${2 + i * 43},270 L ${2 + i * 43},165`}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="21"
          clipPath="url(#fieldClip)"
        />
      ))}

      {/* === WARNING TRACK === */}
      <path
        d="M 18,270 L 18,170 Q 150,22 282,170 L 282,270"
        fill="none"
        stroke="#c9a87a"
        strokeWidth="18"
        strokeLinejoin="round"
        clipPath="url(#fieldClip)"
      />

      {/* === FOUL LINES === */}
      <line x1={HOME.x} y1={HOME.y} x2="5" y2="145" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
      <line x1={HOME.x} y1={HOME.y} x2="295" y2="145" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />

      {/* === INFIELD DIRT CIRCLE === */}
      <circle cx={MOUND.x} cy={MOUND.y} r="60" fill="url(#infieldDirtGrad)" />

      {/* Infield dirt striping */}
      <circle cx={MOUND.x} cy={MOUND.y} r="60" fill="none" stroke="rgba(180,130,80,0.3)" strokeWidth="8" strokeDasharray="4 4" />

      {/* === INFIELD GRASS DIAMOND === */}
      <polygon
        points={`${SECOND.x},${SECOND.y} ${FIRST.x},${FIRST.y} ${HOME.x},${HOME.y} ${THIRD.x},${THIRD.y}`}
        fill="url(#infieldGrassGrad)"
      />

      {/* Infield grass stripes */}
      {[-1, 0, 1].map(i => (
        <line
          key={i}
          x1={THIRD.x + i * 18} y1={THIRD.y}
          x2={FIRST.x + i * 18} y2={FIRST.y}
          stroke="rgba(0,0,0,0.07)"
          strokeWidth="9"
          clipPath="url(#fieldClip)"
        />
      ))}

      {/* === BASELINE CHALK LINES === */}
      <line x1={HOME.x} y1={HOME.y} x2={FIRST.x} y2={FIRST.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1={FIRST.x} y1={FIRST.y} x2={SECOND.x} y2={SECOND.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1={SECOND.x} y1={SECOND.y} x2={THIRD.x} y2={THIRD.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1={THIRD.x} y1={THIRD.y} x2={HOME.x} y2={HOME.y} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />

      {/* === PITCHER'S MOUND === */}
      <ellipse cx={MOUND.x} cy={MOUND.y} rx="10" ry="7.5" fill="#d4a070" stroke="#b08040" strokeWidth="0.8" />
      <ellipse cx={MOUND.x} cy={MOUND.y + 1} rx="4" ry="2.5" fill="#c09050" />

      {/* === BASES === */}
      {/* 2nd base */}
      <rect x={SECOND.x - 5.5} y={SECOND.y - 5.5} width="11" height="11" rx="1"
        fill={onSecond ? '#f5a623' : 'white'} stroke={onSecond ? '#d48a10' : '#bbb'} strokeWidth="0.8"
        transform={`rotate(45,${SECOND.x},${SECOND.y})`}
        style={{ transition: 'fill 0.2s' }}
      />
      {/* 1st base */}
      <rect x={FIRST.x - 5.5} y={FIRST.y - 5.5} width="11" height="11" rx="1"
        fill={onFirst ? '#f5a623' : 'white'} stroke={onFirst ? '#d48a10' : '#bbb'} strokeWidth="0.8"
        transform={`rotate(45,${FIRST.x},${FIRST.y})`}
        style={{ transition: 'fill 0.2s' }}
      />
      {/* 3rd base */}
      <rect x={THIRD.x - 5.5} y={THIRD.y - 5.5} width="11" height="11" rx="1"
        fill={onThird ? '#f5a623' : 'white'} stroke={onThird ? '#d48a10' : '#bbb'} strokeWidth="0.8"
        transform={`rotate(45,${THIRD.x},${THIRD.y})`}
        style={{ transition: 'fill 0.2s' }}
      />

      {/* === HOME PLATE === */}
      <polygon
        points={`${HOME.x},${HOME.y - 4} ${HOME.x + 5},${HOME.y} ${HOME.x + 5},${HOME.y + 6} ${HOME.x - 5},${HOME.y + 6} ${HOME.x - 5},${HOME.y}`}
        fill="white" stroke="#bbb" strokeWidth="0.8"
      />

      {/* Batter's boxes */}
      <rect x={HOME.x - 22} y={HOME.y - 8} width="14" height="18" rx="1"
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <rect x={HOME.x + 8} y={HOME.y - 8} width="14" height="18" rx="1"
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />

      {/* === FIELDERS === */}
      {/* Catcher */}
      <PlayerDot x={HOME.x} y={HOME.y - 22} color="#2c4a8e" size={5.5} label="C" />
      {/* Pitcher */}
      <PlayerDot x={MOUND.x} y={MOUND.y - 14} color="#2c4a8e" size={5.5} label="P" />
      {/* Other fielders */}
      {FIELDERS.map(f => (
        <PlayerDot key={f.label} x={f.x} y={f.y} color="#2c4a8e" size={5.5} label={f.label} />
      ))}

      {/* === RUNNERS ON BASE === */}
      {onFirst && <PlayerDot x={FIRST.x} y={FIRST.y - 12} color="#e85d04" size={6} />}
      {onSecond && <PlayerDot x={SECOND.x + 13} y={SECOND.y} color="#e85d04" size={6} />}
      {onThird && <PlayerDot x={THIRD.x} y={THIRD.y - 12} color="#e85d04" size={6} />}

      {/* === BATTER === */}
      <PlayerDot
        x={HOME.x - 16}
        y={HOME.y - 1}
        color={phase === 'swing' ? '#e85d04' : '#cc3300'}
        size={6.5}
      />

      {/* Outfield fence line */}
      <path
        d="M 2,165 Q 150,2 298,165"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
