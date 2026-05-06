import { useState } from 'react';
import { Setup } from '@/pages/Setup';
import { Game } from '@/pages/Game';

function App() {
  const [teams, setTeams] = useState<{ away: string; home: string } | null>(null);

  if (!teams) {
    return <Setup onStart={(away, home) => setTeams({ away, home })} />;
  }

  return (
    <Game
      awayTeam={teams.away}
      homeTeam={teams.home}
      onNewGame={() => setTeams(null)}
    />
  );
}

export default App;
