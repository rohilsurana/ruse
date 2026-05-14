import { motion, AnimatePresence } from 'framer-motion';

interface GameLogProps {
  log: string[];
}

export function GameLog({ log }: GameLogProps) {
  if (log.length === 0) return null;

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      <AnimatePresence initial={false}>
        {log.map((entry, i) => (
          <motion.p
            key={`${i}-${entry}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: i === log.length - 1 ? 0.8 : 0.4, y: 0 }}
            className="text-xs text-parchment/60"
          >
            {entry}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
