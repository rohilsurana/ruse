import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameAPI } from './hooks/useGameAPI';
import { useLocalGame } from './hooks/useLocalGame';
import { PlayerList } from './components/lobby/PlayerList';
import { LocalLobby } from './components/lobby/LocalLobby';
import { PlayerBoard } from './components/game/PlayerBoard';
import { ActionPhase } from './components/game/ActionPhase';
import { ResponsePhase } from './components/game/ResponsePhase';
import { LoseInfluence } from './components/game/LoseInfluence';
import { ExchangePhase } from './components/game/ExchangePhase';
import { GameOver } from './components/game/GameOver';
import { GameLog } from './components/game/GameLog';
import { PassDevice } from './components/game/PassDevice';
import { GlassCard } from './components/ui/GlassCard';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import type { ClientState, ClientMessage } from './lib/types';

type View = 'menu' | 'create' | 'join' | 'online' | 'local';

function getInitialState(): { view: View; gameCode: string | null } {
  const params = new URLSearchParams(window.location.search);
  const urlCode = params.get('code');

  const savedCode = localStorage.getItem('ruse_game_code');
  const savedName = localStorage.getItem('ruse_player_name');
  const savedPlayerId = localStorage.getItem('ruse_player_id');

  // Resume an in-progress online game before anything else, so a mid-game
  // reload (even with ?code= in the URL) lands back in the game, not the
  // join screen.
  if (savedCode && savedName && savedPlayerId && (!urlCode || urlCode === savedCode)) {
    return { view: 'online', gameCode: savedCode };
  }

  if (urlCode) return { view: 'join', gameCode: urlCode };
  return { view: 'menu', gameCode: null };
}

export default function App() {
  const initial = getInitialState();
  const [view, setView] = useState<View>(initial.view);
  const [gameCode, setGameCode] = useState<string | null>(initial.gameCode);
  const [joinCode, setJoinCode] = useState(initial.gameCode || '');
  const [name, setName] = useState('');

  const goMenu = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setView('menu');
    setGameCode(null);
  };

  const handleBackOnline = () => {
    localStorage.removeItem('ruse_game_code');
    localStorage.removeItem('ruse_player_id');
    localStorage.removeItem('ruse_player_name');
    goMenu();
  };

  const handleJoinGame = () => {
    if (!name.trim()) return;
    localStorage.setItem('ruse_player_name', name.trim());
    setGameCode(joinCode.toUpperCase() || null);
    setView('online');
  };

  const handleCreateGame = () => {
    if (!name.trim()) return;
    localStorage.setItem('ruse_player_name', name.trim());
    setGameCode(null);
    setView('online');
  };

  const onTitleClick = view === 'online' || view === 'local' ? undefined : goMenu;

  return (
    <div className="min-h-dvh bg-gradient-game flex flex-col">
      <header className="py-6 text-center shrink-0">
        <h1
          className={`text-4xl md:text-5xl font-display font-bold text-gold glow-text tracking-widest ${onTitleClick ? 'cursor-pointer' : ''}`}
          onClick={onTitleClick}
        >
          RUSE
        </h1>
        <p className="text-parchment/30 text-xs tracking-[0.3em] uppercase mt-1">A game of courtly deception</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-8">
        <AnimatePresence mode="wait">
          {view === 'menu' && (
            <Menu
              key="menu"
              onCreate={() => setView('create')}
              onJoin={() => setView('join')}
              onLocal={() => setView('local')}
            />
          )}

          {view === 'create' && (
            <NameEntry
              key="create"
              title="Create a Game"
              name={name}
              setName={setName}
              onSubmit={handleCreateGame}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'join' && (
            <JoinEntry
              key="join"
              name={name}
              setName={setName}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              onSubmit={handleJoinGame}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'online' && (
            <OnlineGame key="online" gameCode={gameCode} onBack={handleBackOnline} />
          )}

          {view === 'local' && (
            <LocalGame key="local" onBack={goMenu} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Menu({ onCreate, onJoin, onLocal }: { onCreate: () => void; onJoin: () => void; onLocal: () => void }) {
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
      <div className="flex items-center gap-3 w-full my-1">
        <div className="h-px flex-1 bg-gold/15" />
        <span className="text-parchment/30 text-xs uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-gold/15" />
      </div>
      <Button onClick={onLocal} variant="secondary" className="w-full">Single Device — Pass &amp; Play</Button>
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

function BoardView({ state, send }: { state: ClientState; send: (msg: ClientMessage) => void }) {
  return (
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
  );
}

function OnlineGame({ gameCode, onBack }: { gameCode: string | null; onBack: () => void }) {
  const { gameState: state, error, connected, send } = useGameAPI(true, gameCode);
  const isInGame = !!(state?.myId && state.players.some(p => p.id === state.myId));

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

      {state.phase === 'lobby' && <OnlineLobby state={state} send={send} onBack={onBack} />}
      {state.phase !== 'lobby' && state.phase !== 'game_over' && <BoardView state={state} send={send} />}
      {state.phase === 'game_over' && (
        <GlassCard>
          <GameOver state={state} send={send} />
        </GlassCard>
      )}
    </motion.div>
  );
}

function OnlineLobby({ state, send, onBack }: {
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

function LocalGame({ onBack }: { onBack: () => void }) {
  const {
    phase, setupPlayers, clientState, needsPass, activeActorName,
    addLocalPlayer, removeLocalPlayer, startLocalGame, reveal, send, exit,
  } = useLocalGame();

  const exitToMenu = () => {
    exit();
    onBack();
  };

  if (phase === 'lobby') {
    return (
      <LocalLobby
        players={setupPlayers}
        onAdd={addLocalPlayer}
        onRemove={removeLocalPlayer}
        onStart={startLocalGame}
        onBack={onBack}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-lg space-y-4"
    >
      <AnimatePresence mode="wait">
        {needsPass && (
          <PassDevice key="pass" name={activeActorName} onReveal={reveal} />
        )}
      </AnimatePresence>

      {!needsPass && clientState && phase !== 'game_over' && (
        <BoardView state={clientState} send={send} />
      )}

      {phase === 'game_over' && clientState && (
        <GlassCard>
          <GameOver state={clientState} send={send} />
        </GlassCard>
      )}

      {!needsPass && (
        <button onClick={exitToMenu} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center">
          Exit to menu
        </button>
      )}
    </motion.div>
  );
}
