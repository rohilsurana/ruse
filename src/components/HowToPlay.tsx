import { motion } from 'framer-motion';
import type { Role } from '../lib/types';
import { GlassCard } from './ui/GlassCard';
import { RoleCard } from './ui/RoleCard';

const ROLES: { role: Role; power: string; block: string }[] = [
  { role: 'duke', power: 'Tax — take 3 coins', block: 'Blocks Foreign Aid' },
  { role: 'captain', power: 'Steal — take 2 coins from a player', block: 'Blocks stealing' },
  { role: 'assassin', power: 'Assassinate — pay 3 to force a player to lose influence', block: '—' },
  { role: 'ambassador', power: 'Exchange — draw 2 from the court, keep the best', block: 'Blocks stealing' },
  { role: 'contessa', power: '—', block: 'Blocks assassination' },
];

const GENERAL = [
  { name: 'Income', desc: 'Take 1 coin. Always allowed, never blocked.' },
  { name: 'Foreign Aid', desc: 'Take 2 coins. A Duke can block it.' },
  { name: 'Coup', desc: 'Pay 7 coins to force a player to lose an influence. Unstoppable. Required once you hold 10+ coins.' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <h3 className="text-sm uppercase tracking-[0.2em] text-gold/70 mb-3">{title}</h3>
      {children}
    </GlassCard>
  );
}

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md space-y-4"
    >
      <Section title="Goal">
        <p className="text-parchment/80 text-sm leading-relaxed">
          Be the last player with influence. You start with{' '}
          <span className="text-gold">2 hidden character cards</span> and 2 coins. Lose both cards
          and you&apos;re out of the court.
        </p>
      </Section>

      <Section title="On your turn">
        <div className="space-y-2.5">
          {GENERAL.map((a) => (
            <div key={a.name}>
              <p className="text-parchment text-sm font-medium">{a.name}</p>
              <p className="text-parchment/50 text-xs">{a.desc}</p>
            </div>
          ))}
          <p className="text-parchment/50 text-xs pt-1">
            …or claim one of the characters below to use its power.
          </p>
        </div>
      </Section>

      <Section title="The characters">
        <div className="space-y-3">
          {ROLES.map(({ role, power, block }) => (
            <div key={role} className="flex items-center gap-3">
              <RoleCard role={role} small />
              <div className="flex-1 min-w-0">
                {power !== '—' && <p className="text-parchment text-xs">{power}</p>}
                {block !== '—' && <p className="text-parchment/50 text-xs">{block}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bluffing & challenges">
        <p className="text-parchment/80 text-sm leading-relaxed">
          You don&apos;t need the real card to claim a character — you can bluff. Anyone may{' '}
          <span className="text-crimson">challenge</span> a claim. If it was a bluff, the bluffer
          loses an influence. If it was true, the challenger loses one — and the proven card is
          shuffled back and replaced.
        </p>
      </Section>

      <Section title="Blocking">
        <p className="text-parchment/80 text-sm leading-relaxed">
          Some actions can be blocked by claiming the right character (a Contessa stops an
          assassination, a Duke stops foreign aid). Blocks can be bluffed — and challenged — too.
        </p>
      </Section>

      <button
        onClick={onBack}
        className="text-parchment/30 hover:text-parchment/60 text-sm transition-colors cursor-pointer w-full text-center py-2"
      >
        Back
      </button>
    </motion.div>
  );
}
