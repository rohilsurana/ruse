import { motion } from 'framer-motion';
import type { Role } from '../../lib/types';
import { ROLE_NAMES } from '../../lib/types';

const ROLE_STYLES: Record<Role, { bg: string; icon: string; accent: string }> = {
  cardinal: { bg: 'from-red-900 to-red-950', icon: '✝', accent: 'text-red-300' },
  poisoner: { bg: 'from-emerald-900 to-emerald-950', icon: '☠', accent: 'text-emerald-300' },
  spymaster: { bg: 'from-blue-900 to-blue-950', icon: '👁', accent: 'text-blue-300' },
  envoy: { bg: 'from-amber-900 to-amber-950', icon: '📜', accent: 'text-amber-300' },
  noble: { bg: 'from-purple-900 to-purple-950', icon: '👑', accent: 'text-purple-300' },
};

interface RoleCardProps {
  role: Role;
  revealed?: boolean;
  faceDown?: boolean;
  small?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function RoleCard({ role, revealed, faceDown, small, selected, onClick }: RoleCardProps) {
  const style = ROLE_STYLES[role];
  const size = small ? 'w-16 h-24 text-xs' : 'w-24 h-36 text-sm';

  if (faceDown) {
    return (
      <motion.div
        className={`${size} rounded-lg bg-gradient-to-b from-midnight-light to-midnight border-2 border-gold/30 flex items-center justify-center cursor-default`}
        whileHover={onClick ? { scale: 1.05 } : undefined}
        onClick={onClick}
      >
        <span className="text-gold/40 text-2xl">⚜</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${size} rounded-lg bg-gradient-to-b ${style.bg} border-2 ${selected ? 'border-gold' : revealed ? 'border-white/20 opacity-50' : 'border-gold/30'} flex flex-col items-center justify-center gap-1 ${onClick ? 'cursor-pointer' : 'cursor-default'} ${revealed ? 'grayscale-[0.5]' : ''}`}
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      onClick={onClick}
      layout
    >
      <span className={small ? 'text-lg' : 'text-3xl'}>{style.icon}</span>
      <span className={`${style.accent} font-display font-semibold leading-tight text-center px-1`}>
        {ROLE_NAMES[role]}
      </span>
    </motion.div>
  );
}
