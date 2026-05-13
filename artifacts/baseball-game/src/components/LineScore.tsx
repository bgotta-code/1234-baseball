interface LineScoreProps {
  innings: number; // scheduled game length
  lineScore: [number[], number[]];
  scores: [number, number];
  currentInning: number;
  currentHalf: number;
  awayTeam: string;
  homeTeam: string;
}

export function LineScore({
  innings, lineScore, scores, currentInning, currentHalf, awayTeam, homeTeam,
}: LineScoreProps) {
  // Show all scheduled innings + any extra innings already played/in progress
  const totalCols = Math.max(innings, currentInning, lineScore[0].length, lineScore[1].length);
  const colNums = Array.from({ length: totalCols }, (_, i) => i + 1);

  function cellValue(teamIdx: number, inningIdx: number): string {
    const teamArr = lineScore?.[teamIdx];
    if (!teamArr) return '';
    if (inningIdx < teamArr.length) return String(teamArr[inningIdx]);
    if (inningIdx + 1 === currentInning && teamIdx === currentHalf) return '-';
    return '';
  }

  function isActive(teamIdx: number, inningIdx: number): boolean {
    return inningIdx + 1 === currentInning && teamIdx === currentHalf;
  }

  const teams = [awayTeam, homeTeam];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center border-collapse" style={{ fontSize: 11, minWidth: 270 }}>
        <thead>
          <tr>
            <th className="text-left text-white/35 font-semibold py-0.5 pr-1" style={{ width: 52 }}></th>
            {colNums.map(n => (
              <th
                key={n}
                className={`font-semibold py-0.5 ${n > innings ? 'text-amber-400/60' : 'text-white/35'}`}
                style={{ width: 24 }}
              >
                {n > innings ? 'E' : n}
              </th>
            ))}
            <th className="text-white/60 font-bold py-0.5 pl-1 border-l border-white/15" style={{ width: 26 }}>R</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, tIdx) => (
            <tr key={tIdx}>
              <td className="text-left text-white/65 font-bold py-1 pr-1 truncate" style={{ maxWidth: 52 }}>
                {team}
              </td>
              {colNums.map((_, iIdx) => {
                const active = isActive(tIdx, iIdx);
                const val = cellValue(tIdx, iIdx);
                const isExtra = iIdx + 1 > innings;
                return (
                  <td
                    key={iIdx}
                    className="py-1 font-semibold transition-all rounded"
                    style={{
                      color: active
                        ? '#60a5fa'
                        : val !== ''
                          ? isExtra ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.8)'
                          : 'rgba(255,255,255,0.18)',
                      background: active ? 'rgba(96,165,250,0.15)' : 'transparent',
                    }}
                  >
                    {val === '' ? '·' : val}
                  </td>
                );
              })}
              <td className="py-1 font-black text-white pl-1 border-l border-white/15">
                {scores[tIdx]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
