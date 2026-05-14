import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWebSocket } from './hooks/useWebSocket';
import { PlayerList } from './components/lobby/PlayerList';
import { PlayerBoard } from './components/game/PlayerBoard';
import { ActionPhase } from './components/game/ActionPhase';
import { ResponsePhase } from './components/game/ResponsePhase';
import { LoseInfluence } from './components/game/LoseInfluence';
import { ExchangePhase } from './components/game/ExchangePhase';
import { GameOver } from './components/game/GameOver';
import { GameLog } from './components/game/GameLog';
import { GlassCard } from './components/ui/GlassCard';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import type { ClientState, ClientMessage } from './lib/types';

type Screen = 'home' | 'create' | 'join' | 'playing';

function getInitialState(): { screen: Screen; gameCode: string | null } {
  const params = new URLSearchParams(window.location.search);
  const urlCode = params.get('code');
  if (urlCode) return { screen: 'join', gameCode: urlCode };

  const savedCode = sessionStorage.getItem('ruse_game_code');
  const savedName = sessionStorage.getItem('ruse_player_name');
  if (savedCode && savedName) return { screen: 'playing', gameCode: savedCode };

  return { screen: 'home', gameCode: null };
}

export default function App() {
  const initial = getInitialState();
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [gameCode, setGameCode] = useState<string | null>(initial.gameCode);
  const [joinCode, setJoinCode] = useState(initial.gameCode || '');
  const [name, setName] = useState('');

  const wsActive = screen === 'playing';
  const { gameState, error, connected, send } = useWebSocket(wsActive, gameCode);

  const isInGame = gameState?.myId && gameState.players.some(p => p.id === gameState.myId);

  const handleBack = () => {
    sessionStorage.removeItem('ruse_game_code');
    sessionStorage.removeItem('ruse_player_id');
    sessionStorage.removeItem('ruse_player_name');
    window.history.replaceState({}, '', window.location.pathname);
    setScreen('home');
    setGameCode(null);
  };

  const handleJoinGame = () => {
    if (!name.trim()) return;
    sessionStorage.setItem('ruse_player_name', name.trim());
    setGameCode(joinCode.toUpperCase() || null);
    setScreen('playing');
  };

  const handleCreateGame = () => {
    if (!name.trim()) return;
    sessionStorage.setItem('ruse_player_name', name.trim());
    setGameCode(null);
    setScreen('playing');
  };

  return (
    <div className="min-h-dvh bg-gradient-game flex flex-col">
      <header className="py-6 text-center shrink-0">
        <h1
          className="text-4xl md:text-5xl font-display font-bold text-gold glow-text tracking-widest cursor-pointer"
          onClick={screen !== 'playing' ? handleBack : undefined}
        >
          RUSE
        </h1>
        <p className="text-parchment/30 text-xs tracking-[0.3em] uppercase mt-1">A game of courtly deception</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-8">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <HomeScreen
              key="home"
              onCreate={() => setScreen('create')}
              onJoin={() => setScreen('join')}
            />
          )}

          {screen === 'create' && (
            <NameEntry
              key="create"
              title="Create a Game"
              name={name}
              setName={setName}
              onSubmit={handleCreateGame}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'join' && (
            <JoinEntry
              key="join"
              name={name}
              setName={setName}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              onSubmit={handleJoinGame}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'playing' && (
            <GameScreen
              key="playing"
              state={gameState}
              isInGame={!!isInGame}
              connected={connected}
              error={error}
              send={send}
              onBack={handleBack}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function HomeScreen({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center gap-4 w-full max-w-sm"
    >
      <p className="text-parchment/40 text-center text-sm mb-2">
        Bluff, steal, and scheme your way to power in the Renaissance court.
      </p>
      <Button onClick={onCreate} className="w-full">Create Game</Button>
      <Button onClick={onJoin} variant="secondary" className="w-full">Join Game</Button>
    </motion.div>
  );
}

function NameEntry({ title, name, setName, onSubmit, onBack }: {
  title: string;
  name: string;
  setName: (n: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm space-y-4"
    >
      <GlassCard>
        <h2 className="text-lg font-display text-gold mb-4">{title}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <Button type="submit" disabled={!name.trim()} className="w-full">Enter the Court</Button>
        </form>
      </GlassCard>
      <button onClick={onBack} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center">
        Back
      </button>
    </motion.div>
  );
}

function JoinEntry({ name, setName, joinCode, setJoinCode, onSubmit, onBack }: {
  name: string;
  setName: (n: string) => void;
  joinCode: string;
  setJoinCode: (c: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm space-y-4"
    >
      <GlassCard>
        <h2 className="text-lg font-display text-gold mb-4">Join a Game</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
          <Input
            placeholder="Game code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoFocus
          />
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
          <Button type="submit" disabled={!name.trim() || !joinCode.trim()} className="w-full">
            Join Court
          </Button>
        </form>
      </GlassCard>
      <button onClick={onBack} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center">
        Back
      </button>
    </motion.div>
  );
}

function GameScreen({ state, isInGame, connected, error, send, onBack }: {
  state: ClientState | null;
  isInGame: boolean;
  connected: boolean;
  error: string | null;
  send: (msg: ClientMessage) => void;
  onBack: () => void;
}) {
  if (!connected) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
        <p className="text-parchment/50 text-sm">Connecting to the court...</p>
      </motion.div>
    );
  }

  if (!state || !isInGame) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-4">
        <p className="text-parchment/50 text-sm">Joining the court...</p>
        <button onClick={onBack} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer">
          Back to lobby
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-lg space-y-4"
    >
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2 rounded-lg bg-crimson/20 border border-crimson/30 text-crimson text-sm text-center"
        >
          {error}
        </motion.div>
      )}

      {state.phase === 'lobby' && (
        <LobbyView state={state} send={send} onBack={onBack} />
      )}

      {state.phase !== 'lobby' && state.phase !== 'game_over' && (
        <>
          <GlassCard>
            <PlayerBoard state={state} />
          </GlassCard>

          <GlassCard>
            <AnimatePresence mode="wait">
              {state.phase === 'action' && (
                <ActionPhase key="action" state={state} send={send} />
              )}
              {(state.phase === 'action_response' || state.phase === 'block' || state.phase === 'block_response') && (
                <ResponsePhase key="response" state={state} send={send} />
              )}
              {state.phase === 'lose_influence' && (
                <LoseInfluence key="lose" state={state} send={send} />
              )}
              {state.phase === 'exchange' && (
                <ExchangePhase key="exchange" state={state} send={send} />
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard className="!p-3">
            <GameLog log={state.log} />
          </GlassCard>
        </>
      )}

      {state.phase === 'game_over' && (
        <GlassCard>
          <GameOver state={state} send={send} />
        </GlassCard>
      )}
    </motion.div>
  );
}

function LobbyView({ state, send, onBack }: {
  state: ClientState;
  send: (msg: ClientMessage) => void;
  onBack: () => void;
}) {
  const shareUrl = `${window.location.origin}?code=${state.gameCode}`;

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      <GlassCard>
        <div className="text-center mb-4">
          <p className="text-parchment/40 text-xs uppercase tracking-wider">Game Code</p>
          <p className="text-3xl font-display font-bold text-gold tracking-[0.4em] mt-1">{state.gameCode}</p>
        </div>

        <div className="flex gap-2 mb-4">
          <Input readOnly value={shareUrl} className="text-xs" />
          <Button
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="shrink-0 text-xs"
          >
            Copy
          </Button>
        </div>

        <PlayerList
          players={state.players}
          myId={state.myId}
          hostId={state.players.find(p => state.isHost && p.id === state.myId)?.id ?? state.players[0]?.id}
        />
      </GlassCard>

      <div className="space-y-2">
        {state.isHost && (
          <Button
            onClick={() => send({ type: 'start_game' })}
            disabled={state.players.length < 2}
            className="w-full"
          >
            Start Game ({state.players.length}/6 players)
          </Button>
        )}
        {!state.isHost && (
          <p className="text-parchment/40 text-sm text-center">Waiting for host to start...</p>
        )}
        <button onClick={onBack} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center">
          Leave
        </button>
      </div>
    </div>
  );
}
