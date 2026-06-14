import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameEvent } from '../../lib/types';
import { ROLE_NAMES } from '../../lib/types';
import { RoleCard } from '../ui/RoleCard';

interface EventBannerProps {
  event: GameEvent | null;
}

const SHOW_MS = 2800;

/**
 * Transient overlay that turns a challenge resolution into a moment — the
 * climax of the game. Driven by the event's seq so each challenge fires once.
 */
export function EventBanner({ event }: EventBannerProps) {
  const [dismissedSeq, setDismissedSeq] = useState(0);

  const activeSeq = event && event.seq > dismissedSeq ? event.seq : null;
  const shown = activeSeq != null ? event : null;

  useEffect(() => {
    if (activeSeq == null) return;
    const id = setTimeout(() => setDismissedSeq(activeSeq), SHOW_MS);
    return () => clearTimeout(id);
  }, [activeSeq]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-dark/70 backdrop-blur-sm px-4"
          onClick={() => setDismissedSeq(shown.seq)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className={`glass flex flex-col items-center gap-4 px-8 py-7 text-center max-w-xs ${
              shown.proven ? 'border-emerald/40' : 'border-crimson/40'
            }`}
          >
            <p className={`text-xs uppercase tracking-[0.3em] ${shown.proven ? 'text-emerald-light' : 'text-crimson'}`}>
              {shown.context === 'block' ? 'Block challenged' : 'Challenge'}
            </p>

            {shown.proven ? (
              <>
                <RoleCard role={shown.claimedRole} />
                <div>
                  <p className="text-lg font-display text-parchment">
                    {shown.claimantName} had the {ROLE_NAMES[shown.claimedRole]}!
                  </p>
                  <p className="text-parchment/50 text-sm mt-1">
                    {shown.challengerName}&apos;s challenge backfires
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl">🃏</div>
                <div>
                  <p className="text-lg font-display text-crimson">
                    {shown.claimantName} was bluffing!
                  </p>
                  <p className="text-parchment/50 text-sm mt-1">
                    No {ROLE_NAMES[shown.claimedRole]} — {shown.challengerName} called it
                  </p>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
