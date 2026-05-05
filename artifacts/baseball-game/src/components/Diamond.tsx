interface DiamondProps {
  bases: [boolean, boolean, boolean];
}

export function Diamond({ bases }: DiamondProps) {
  const [first, second, third] = bases;

  return (
    <svg width="140" height="120" viewBox="0 0 130 115" overflow="visible" className="mx-auto block">
      <polygon
        id="base-second"
        points="65,8 83,26 65,44 47,26"
        fill={second ? '#378ADD' : '#d1d5db'}
        stroke={second ? '#185FA5' : '#9ca3af'}
        strokeWidth="1.5"
        style={{ transition: 'fill 0.2s, stroke 0.2s' }}
      />
      <polygon
        id="base-third"
        points="8,60 26,42 44,60 26,78"
        fill={third ? '#378ADD' : '#d1d5db'}
        stroke={third ? '#185FA5' : '#9ca3af'}
        strokeWidth="1.5"
        style={{ transition: 'fill 0.2s, stroke 0.2s' }}
      />
      <polygon
        id="base-first"
        points="86,60 104,42 122,60 104,78"
        fill={first ? '#378ADD' : '#d1d5db'}
        stroke={first ? '#185FA5' : '#9ca3af'}
        strokeWidth="1.5"
        style={{ transition: 'fill 0.2s, stroke 0.2s' }}
      />
      <polygon
        points="65,76 83,94 65,112 47,94"
        fill="#6b7280"
        stroke="#4b5563"
        strokeWidth="1.5"
      />
    </svg>
  );
}
