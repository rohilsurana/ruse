import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LocalLobbyProps {
  players: { id: string; name: string }[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onBack: () => void;
}

export function LocalLobby({ players, onAdd, onRemove, onStart, onBack }: LocalLobbyProps) {
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm space-y-4"
    >
      <GlassCard>
        <h2 className="text-lg font-display text-gold mb-1">Pass &amp; Play</h2>
        <p className="text-parchment/40 text-xs mb-4">
          Add everyone at the table. You&apos;ll pass the device around as the game plays.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2 mb-4">
          <Input
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <Button type="submit" disabled={!name.trim() || players.length >= 6} className="shrink-0">
            Add
          </Button>
        </form>

        <div className="space-y-2">
          <AnimatePresence>
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between px-4 py-2 rounded-lg bg-midnight-light/50 border border-gold/10"
              >
                <span className="text-parchment text-sm">
                  <span className="text-gold/40 mr-2">{i + 1}.</span>
                  {p.name}
                </span>
                <button
                  onClick={() => onRemove(p.id)}
                  className="text-parchment/30 hover:text-crimson text-xs transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {players.length === 0 && (
            <p className="text-parchment/30 text-xs text-center py-2">No players yet</p>
          )}
        </div>
      </GlassCard>

      <div className="space-y-2">
        <Button
          onClick={onStart}
          disabled={players.length < 2}
          className="w-full"
        >
          Start Game ({players.length}/6 players)
        </Button>
        {players.length < 2 && (
          <p className="text-parchment/40 text-xs text-center">Add at least 2 players</p>
        )}
        <button onClick={onBack} className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center">
          Back
        </button>
      </div>
    </motion.div>
  );
}
