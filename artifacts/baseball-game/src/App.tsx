import { useState } from 'react';
import { Setup } from '@/pages/Setup';
import { Game } from '@/pages/Game';
import { IS_PAID } from '@/lib/config';

interface Teams {
  away: string;
  home: string;
  innings: number;
}

function App() {
  const [teams, setTeams] = useState<Teams | null>(null);

  if (!teams) {
    return (
      <Setup
        isPaid={IS_PAID}
        onStart={(away, home, innings) => setTeams({ away, home, innings })}
      />
    );
  }

  return (
    <Game
      awayTeam={teams.away}
      homeTeam={teams.home}
      innings={teams.innings}
      isPaid={IS_PAID}
      onNewGame={() => setTeams(null)}
    />
  );
}

export default App;
