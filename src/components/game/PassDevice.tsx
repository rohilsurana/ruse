import { motion } from 'framer-motion';
import { Button } from '../ui/Button';

interface PassDeviceProps {
  name: string;
  onReveal: () => void;
}

export function PassDevice({ name, onReveal }: PassDeviceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex flex-col items-center gap-6 py-16 text-center"
    >
      <div className="text-5xl">🎭</div>
      <div>
        <p className="text-parchment/40 text-xs uppercase tracking-[0.3em]">Pass the device to</p>
        <p className="text-3xl font-display text-gold glow-text mt-2">{name}</p>
      </div>
      <p className="text-parchment/40 text-sm max-w-xs">
        Make sure no one else can see the screen before continuing.
      </p>
      <Button onClick={onReveal} className="w-full max-w-xs">
        I&apos;m {name} — Reveal
      </Button>
    </motion.div>
  );
}
