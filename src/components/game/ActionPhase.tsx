import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClientState, ClientMessage, ActionType } from '../../lib/types';
import { ACTION_LABELS, ACTION_DESCRIPTIONS, ACTION_CONFIG } from '../../lib/types';
import { Button } from '../ui/Button';

interface ActionPhaseProps {
  state: ClientState;
  send: (msg: ClientMessage) => void;
}

const ACTIONS: ActionType[] = ['income', 'foreign_aid', 'tax', 'steal', 'assassinate', 'exchange', 'coup'];

export function ActionPhase({ state, send }: ActionPhaseProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const isMyTurn = state.currentPlayerId === state.myId;
  const me = state.players.find(p => p.id === state.myId)!;
  const mustCoup = me.coins >= 10;

  if (!isMyTurn) {
    const current = state.players.find(p => p.id === state.currentPlayerId);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-4"
      >
        <p className="text-parchment/60 text-sm">
          Waiting for <span className="text-gold font-medium">{current?.name}</span> to act...
        </p>
      </motion.div>
    );
  }

  const targets = state.players.filter(p => p.isAlive && p.id !== state.myId);
  const needsTarget = selectedAction && ACTION_CONFIG[selectedAction].requiresTarget;

  const canAfford = (action: ActionType) => me.coins >= ACTION_CONFIG[action].cost;

  const handleConfirm = () => {
    if (!selectedAction) return;
    if (needsTarget && !selectedTarget) return;
    send({ type: 'action', action: selectedAction, targetId: selectedTarget ?? undefined });
    setSelectedAction(null);
    setSelectedTarget(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <p className="text-gold text-sm font-display text-center">Your turn — choose an action</p>
      {mustCoup && <p className="text-crimson text-xs text-center">You have 10+ coins — you must coup</p>}

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const disabled = !canAfford(action) || (mustCoup && action !== 'coup');
          const selected = selectedAction === action;
          return (
            <button
              key={action}
              disabled={disabled}
              onClick={() => {
                setSelectedAction(action);
                setSelectedTarget(null);
              }}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                selected
                  ? 'border-gold bg-gold/10'
                  : 'border-gold/10 bg-midnight-light/30 hover:border-gold/30'
              }`}
            >
              <div className="text-sm font-medium text-parchment">{ACTION_LABELS[action]}</div>
              <div className="text-[11px] text-parchment/40 mt-0.5">{ACTION_DESCRIPTIONS[action]}</div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {needsTarget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <p className="text-parchment/50 text-xs">Choose a target:</p>
            <div className="flex flex-wrap gap-2">
              {targets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedTarget(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all cursor-pointer ${
                    selectedTarget === p.id
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-gold/10 bg-midnight-light/30 text-parchment/70 hover:border-gold/30'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedAction && (!needsTarget || selectedTarget) && (
        <Button onClick={handleConfirm} className="w-full">
          Confirm {ACTION_LABELS[selectedAction]}
          {selectedTarget && ` on ${targets.find(t => t.id === selectedTarget)?.name}`}
        </Button>
      )}
    </motion.div>
  );
}
