import { useState, useEffect } from 'react';
import { Setup } from '@/pages/Setup';
import { Game } from '@/pages/Game';
import { OnlineLobby } from '@/pages/OnlineLobby';
import { OnlineGame } from '@/pages/OnlineGame';
import { DesktopGate } from '@/components/DesktopGate';
import { UpgradeModal } from '@/components/UpgradeModal';
import { usePro } from '@/hooks/usePro';
import { generateRoomCode, RoomSetup } from '@/lib/roomLogic';

type Screen =
  | { type: 'setup' }
  | { type: 'solo'; teams: { away: string; home: string; innings: number } }
  | { type: 'online-lobby'; mode: 'host'; roomCode: string; setup: RoomSetup }
  | { type: 'online-lobby'; mode: 'guest'; roomCode: string; guestTeamName: string }
  | { type: 'online-game'; roomCode: string; role: 'host' | 'guest'; setup: RoomSetup };

function AppContent() {
  const [screen, setScreen] = useState<Screen>({ type: 'setup' });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { isPro, activate, activateFromUrl } = usePro();

  // Activate from Stripe redirect (?license=KEY in URL)
  useEffect(() => {
    activateFromUrl();
  }, [activateFromUrl]);

  if (screen.type === 'solo') {
    return (
      <Game
        awayTeam={screen.teams.away}
        homeTeam={screen.teams.home}
        innings={screen.teams.innings}
        isPaid={isPro}
        onNewGame={() => setScreen({ type: 'setup' })}
      />
    );
  }

  if (screen.type === 'online-lobby') {
    return (
      <OnlineLobby
        mode={screen.mode}
        roomCode={screen.roomCode}
        setup={screen.mode === 'host' ? (screen as { type: 'online-lobby'; mode: 'host'; roomCode: string; setup: RoomSetup }).setup : undefined}
        guestTeamName={screen.mode === 'guest' ? (screen as { type: 'online-lobby'; mode: 'guest'; roomCode: string; guestTeamName: string }).guestTeamName : undefined}
        isPaid={isPro}
        onGameReady={(setup, roomCode, role) =>
          setScreen({ type: 'online-game', roomCode, role, setup })
        }
        onLeave={() => setScreen({ type: 'setup' })}
      />
    );
  }

  if (screen.type === 'online-game') {
    return (
      <OnlineGame
        roomCode={screen.roomCode}
        role={screen.role}
        setup={screen.setup}
        isPaid={isPro}
        onLeave={() => setScreen({ type: 'setup' })}
      />
    );
  }

  return (
    <>
      <Setup
        isPaid={isPro}
        onUpgradeClick={() => setShowUpgrade(true)}
        onStart={(away, home, innings) =>
          setScreen({ type: 'solo', teams: { away, home, innings } })
        }
        onCreateOnline={(hostName, innings, hostRole) => {
          const code = generateRoomCode();
          const setup = hostRole === 'home'
            ? { awayTeam: 'Away', homeTeam: hostName, innings, hostRole }
            : { awayTeam: hostName, homeTeam: 'Home', innings, hostRole };
          setScreen({ type: 'online-lobby', mode: 'host', roomCode: code, setup });
        }}
        onJoinOnline={(code, teamName) =>
          setScreen({ type: 'online-lobby', mode: 'guest', roomCode: code.toUpperCase(), guestTeamName: teamName })
        }
      />
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onActivate={activate}
        />
      )}
    </>
  );
}

function App() {
  return (
    <DesktopGate>
      <AppContent />
    </DesktopGate>
  );
}

export default App;
