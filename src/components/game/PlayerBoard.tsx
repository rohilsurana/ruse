import { motion } from 'framer-motion';
import type { ClientState, Role } from '../../lib/types';
import { RoleCard } from '../ui/RoleCard';

interface PlayerBoardProps {
  state: ClientState;
}

export function PlayerBoard({ state }: PlayerBoardProps) {
  const { players, myId, currentPlayerId, pendingAction, myInfluences } = state;

  return (
    <div className="space-y-3">
      {players.map((p) => {
        const isMe = p.id === myId;
        const isCurrent = p.id === currentPlayerId;
        const isTarget = pendingAction?.targetId === p.id;

        return (
          <motion.div
            key={p.id}
            layout
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
              !p.isAlive
                ? 'bg-midnight-dark/50 border-white/5 opacity-50'
                : isCurrent
                  ? 'bg-gold/5 border-gold/30'
                  : isTarget
                    ? 'bg-crimson/5 border-crimson/30'
                    : 'bg-midnight-light/30 border-gold/10'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${p.isAlive ? 'text-parchment' : 'text-parchment/40 line-through'}`}>
                  {p.name}
                </span>
                {isMe && <span className="text-[10px] text-gold/50 uppercase tracking-wider">you</span>}
                {isCurrent && p.isAlive && <span className="text-[10px] text-gold uppercase tracking-wider">turn</span>}
                {p.hasResponded && <span className="text-[10px] text-emerald-400/60">&#10003;</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gold/60">{p.coins} coin{p.coins !== 1 ? 's' : ''}</span>
                <div className="flex gap-1">
                  {isMe
                    ? myInfluences.map((inf, i) => (
                        <RoleCard key={i} role={inf.role} revealed={inf.revealed} small />
                      ))
                    : (
                      <>
                        {p.revealedInfluences.map((role: Role, i: number) => (
                          <RoleCard key={`r-${i}`} role={role} revealed small />
                        ))}
                        {Array.from({ length: p.influenceCount }).map((_, i) => (
                          <RoleCard key={`h-${i}`} role="cardinal" faceDown small />
                        ))}
                      </>
                    )
                  }
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
