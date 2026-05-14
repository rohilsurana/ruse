import { motion } from 'framer-motion';
import type { ClientState, ClientMessage } from '../../lib/types';
import { Button } from '../ui/Button';

interface GameOverProps {
  state: ClientState;
  send: (msg: ClientMessage) => void;
}

export function GameOver({ state, send }: GameOverProps) {
  const winner = state.players.find(p => p.id === state.winner);
  const isWinner = state.winner === state.myId;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 py-8"
    >
      <div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-5xl mb-4"
        >
          {isWinner ? '👑' : '⚔'}
        </motion.div>
        <h2 className="text-2xl font-display text-gold glow-text">
          {isWinner ? 'You Rule the Court!' : `${winner?.name} Wins!`}
        </h2>
        <p className="text-parchment/50 text-sm mt-2">
          {isWinner ? 'Your cunning has prevailed.' : 'The court has a new ruler.'}
        </p>
      </div>

      {state.isHost && (
        <Button onClick={() => send({ type: 'rematch' })} className="w-full">
          Play Again
        </Button>
      )}

      {!state.isHost && (
        <p className="text-parchment/40 text-xs">Waiting for host to start a new game...</p>
      )}
    </motion.div>
  );
}
