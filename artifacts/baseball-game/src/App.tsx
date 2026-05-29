import { useState, useEffect, Component, ReactNode } from 'react';
import { Setup } from '@/pages/Setup';
import { Game } from '@/pages/Game';
import { OnlineLobby } from '@/pages/OnlineLobby';
import { OnlineGame } from '@/pages/OnlineGame';
import { DesktopGate } from '@/components/DesktopGate';
import { UpgradeModal } from '@/components/UpgradeModal';
import { usePro } from '@/hooks/usePro';
import { generateRoomCode, RoomSetup } from '@/lib/roomLogic';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)' }}
        >
          <div className="w-full max-w-sm flex flex-col gap-4 text-center">
            <div className="text-4xl">💥</div>
            <h2 className="text-white font-black text-lg">Something crashed</h2>
            <div
              className="rounded-xl p-4 text-left border border-red-500/30"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <p className="text-red-300 text-[11px] font-mono break-all whitespace-pre-wrap">
                {error.name}: {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </p>
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="w-full py-3 rounded-xl font-bold text-white text-[14px]"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <DesktopGate>
        <AppContent />
      </DesktopGate>
    </ErrorBoundary>
  );
}

export default App;
