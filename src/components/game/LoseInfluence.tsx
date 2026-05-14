import { motion } from 'framer-motion';
import type { ClientState, ClientMessage } from '../../lib/types';
import { RoleCard } from '../ui/RoleCard';

interface LoseInfluenceProps {
  state: ClientState;
  send: (msg: ClientMessage) => void;
}

export function LoseInfluence({ state, send }: LoseInfluenceProps) {
  const { mustLoseInfluence, myInfluences, players, myId } = state;
  const losingPlayer = players.find(p =>
    p.id !== myId && state.phase === 'lose_influence' && !mustLoseInfluence
  );

  if (mustLoseInfluence) {
    const unrevealed = myInfluences
      .map((inf, i) => ({ ...inf, index: i }))
      .filter(inf => !inf.revealed);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
        <p className="text-crimson text-sm font-display">You must reveal an influence</p>
        <div className="flex justify-center gap-3">
          {unrevealed.map(({ role, index }) => (
            <RoleCard
              key={index}
              role={role}
              onClick={() => send({ type: 'lose_influence', influenceIndex: index })}
            />
          ))}
        </div>
        <p className="text-parchment/40 text-xs">Choose which card to reveal</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
      <p className="text-parchment/60 text-sm">
        {losingPlayer
          ? `Waiting for ${losingPlayer.name} to reveal a card...`
          : 'Waiting for a player to reveal a card...'}
      </p>
    </motion.div>
  );
}
