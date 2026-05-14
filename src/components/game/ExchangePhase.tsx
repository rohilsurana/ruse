import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ClientState, ClientMessage } from '../../lib/types';
import { RoleCard } from '../ui/RoleCard';
import { Button } from '../ui/Button';

interface ExchangePhaseProps {
  state: ClientState;
  send: (msg: ClientMessage) => void;
}

export function ExchangePhase({ state, send }: ExchangePhaseProps) {
  const { exchangeOptions, myInfluences } = state;
  const [selected, setSelected] = useState<number[]>([]);

  if (!exchangeOptions) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
        <p className="text-parchment/60 text-sm">Waiting for the Envoy to choose cards...</p>
      </motion.div>
    );
  }

  const keepCount = myInfluences.filter(i => !i.revealed).length;

  const toggleCard = (index: number) => {
    setSelected(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : prev.length < keepCount
          ? [...prev, index]
          : prev
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
      <p className="text-gold text-sm font-display">Choose {keepCount} card{keepCount > 1 ? 's' : ''} to keep</p>
      <div className="flex justify-center gap-3 flex-wrap">
        {exchangeOptions.map((role, i) => (
          <RoleCard
            key={i}
            role={role}
            selected={selected.includes(i)}
            onClick={() => toggleCard(i)}
          />
        ))}
      </div>
      <p className="text-parchment/40 text-xs">
        Selected {selected.length} of {keepCount}
      </p>
      <Button
        disabled={selected.length !== keepCount}
        onClick={() => send({ type: 'exchange_select', kept: selected })}
        className="w-full"
      >
        Confirm Selection
      </Button>
    </motion.div>
  );
}
