import { motion, AnimatePresence } from 'framer-motion';
import type { ClientPlayer } from '../../lib/types';

interface PlayerListProps {
  players: ClientPlayer[];
  myId: string;
  hostId?: string;
}

export function PlayerList({ players, myId, hostId }: PlayerListProps) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {players.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center justify-between px-4 py-2 rounded-lg bg-midnight-light/50 border border-gold/10"
          >
            <span className="text-parchment text-sm">
              {p.name}
              {p.id === myId && <span className="text-gold/50 ml-2">(you)</span>}
              {p.id === hostId && <span className="text-gold ml-2">&#9733;</span>}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
