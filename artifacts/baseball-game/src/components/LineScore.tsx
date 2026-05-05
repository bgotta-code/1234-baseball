import { INNINGS } from '@/lib/gameLogic';

interface LineScoreProps {
  lineScore: [number[], number[]];
  scores: [number, number];
  currentInning: number;
  currentHalf: number;
}

export function LineScore({ lineScore, scores, currentInning, currentHalf }: LineScoreProps) {
  const innings = Array.from({ length: INNINGS }, (_, i) => i + 1);

  function cellValue(teamIdx: number, inningIdx: number): string {
    const teamArr = lineScore?.[teamIdx];
    if (!teamArr) return '';
    const completedHalves = teamArr.length;
    if (inningIdx < completedHalves) {
      return String(lineScore[teamIdx][inningIdx]);
    }
    // Current in-progress half-inning
    const inningNum = inningIdx + 1;
    if (inningNum === currentInning && teamIdx === currentHalf) {
      return '-';
    }
    // Home team bottom of last inning if game ended early (walk-off) — show X
    // (We just leave blank for future innings)
    return '';
  }

  function isActive(teamIdx: number, inningIdx: number): boolean {
    return inningIdx + 1 === currentInning && teamIdx === currentHalf;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-center border-collapse min-w-[280px]" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th className="w-12 text-left pl-2 text-gray-400 font-medium py-1">Team</th>
            {innings.map(n => (
              <th key={n} className="text-gray-400 font-medium py-1 w-7">{n}</th>
            ))}
            <th className="text-gray-600 font-semibold py-1 w-8 border-l border-gray-200 pl-1">R</th>
          </tr>
        </thead>
        <tbody>
          {(['Away', 'Home'] as const).map((team, tIdx) => (
            <tr key={team}>
              <td className="text-left pl-2 text-gray-600 font-semibold py-1.5">{team}</td>
              {innings.map((_, iIdx) => {
                const active = isActive(tIdx, iIdx);
                const val = cellValue(tIdx, iIdx);
                return (
                  <td
                    key={iIdx}
                    className={`py-1.5 rounded font-medium transition-all ${
                      active
                        ? 'text-blue-700 bg-blue-50 font-bold'
                        : val !== ''
                          ? 'text-gray-700'
                          : 'text-gray-300'
                    }`}
                  >
                    {val === '' ? '·' : val}
                  </td>
                );
              })}
              <td className="py-1.5 font-bold text-gray-800 border-l border-gray-200 pl-1">
                {scores[tIdx]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
